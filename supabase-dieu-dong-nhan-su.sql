-- ============================================================
-- ĐIỀU ĐỘNG NHÂN SỰ GIỮA CÁC MÁY TRONG CÙNG LỆNH SẢN XUẤT
-- ============================================================
--
-- Nguyên tắc:
-- 1. Không sửa/xóa phan_cong_nhan_su gốc trong lenh_sx.
-- 2. Chỉ ghi nhận phát sinh vào dieu_dong_nhan_su.
-- 3. Cho phép may_goc = may_dieu_dong.
-- 4. Không cho một nhân sự có 2 lịch điều động bị chồng thời gian.
-- 5. Không cho thời gian kết thúc <= thời gian bắt đầu.
-- 6. Lưu snapshot vai trò và máy gốc tại thời điểm điều động.
-- 7. Không mở quyền CRUD public bằng RLS.
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;


-- ============================================================
-- 2. TẠO BẢNG
-- ============================================================

create table if not exists public.dieu_dong_nhan_su (
    id uuid primary key default gen_random_uuid(),

    -- Ngày làm việc
    ngay_lam_viec date not null,

    -- Ca làm việc
    ca text not null,

    -- Lệnh sản xuất
    ma_lenh_sx text not null,

    -- Mã nhân sự
    ma_nhan_su text not null,

    -- Snapshot vai trò tại thời điểm điều động
    vai_tro text,

    -- Máy ban đầu
    may_goc text not null,

    -- Máy được điều động tới
    -- Có thể giống may_goc
    -- Ví dụ: Máy A -> Máy A để ghi nhận đi làm sớm
    may_dieu_dong text not null,

    -- Thời gian điều động
    thoi_gian_bat_dau time not null,
    thoi_gian_ket_thuc time not null,

    -- Ghi chú
    ghi_chu text,

    -- Audit
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- ========================================================
    -- VALIDATION
    -- ========================================================

    constraint chk_dieu_dong_thoi_gian
        check (thoi_gian_ket_thuc > thoi_gian_bat_dau),

    constraint chk_dieu_dong_ca_not_blank
        check (btrim(ca) <> ''),

    constraint chk_dieu_dong_lenh_not_blank
        check (btrim(ma_lenh_sx) <> ''),

    constraint chk_dieu_dong_nhan_su_not_blank
        check (btrim(ma_nhan_su) <> ''),

    constraint chk_dieu_dong_may_goc_not_blank
        check (btrim(may_goc) <> ''),

    constraint chk_dieu_dong_may_dieu_dong_not_blank
        check (btrim(may_dieu_dong) <> '')
);


-- ============================================================
-- 3. INDEX
-- ============================================================

-- Màn hình:
-- Ngày -> Ca -> Lệnh sản xuất
create index if not exists idx_dieu_dong_ns_lookup
on public.dieu_dong_nhan_su (
    ngay_lam_viec,
    ca,
    ma_lenh_sx
);


-- Tra cứu lịch điều động của nhân sự
create index if not exists idx_dieu_dong_ns_personnel
on public.dieu_dong_nhan_su (
    ma_nhan_su,
    ngay_lam_viec
);


-- Tra cứu theo LSX + nhân sự
create index if not exists idx_dieu_dong_ns_lenh_person
on public.dieu_dong_nhan_su (
    ma_lenh_sx,
    ma_nhan_su,
    ngay_lam_viec
);


-- ============================================================
-- 4. CHỐNG TRÙNG THỜI GIAN ĐIỀU ĐỘNG
-- ============================================================
--
-- Một nhân sự không thể có 2 lịch điều động chồng nhau
-- trong cùng một ngày.
--
-- Ví dụ:
--
-- NV000049
-- 08:00 -> 10:00
--
-- NV000049
-- 09:00 -> 11:00
--
-- => PostgreSQL CHẶN.
--
-- Nhưng:
--
-- 08:00 -> 10:00
-- 10:00 -> 12:00
--
-- => ĐƯỢC PHÉP.
--
-- Lưu ý:
-- Constraint này áp dụng cho các bản ghi trong
-- dieu_dong_nhan_su.
--
-- Việc kiểm tra overlap với phân công gốc trong
-- lenh_sx.phan_cong_nhan_su cần được xử lý ở backend.
-- ============================================================

alter table public.dieu_dong_nhan_su
drop constraint if exists ex_dieu_dong_ns_overlap;


alter table public.dieu_dong_nhan_su
add constraint ex_dieu_dong_ns_overlap
exclude using gist (
    ma_nhan_su with =,
    ngay_lam_viec with =,
    tsrange(
        ngay_lam_viec + thoi_gian_bat_dau,
        ngay_lam_viec + thoi_gian_ket_thuc,
        '[)'
    ) with &&
);


-- ============================================================
-- 5. UPDATED_AT
-- ============================================================

create or replace function public.set_dieu_dong_nhan_su_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


drop trigger if exists trg_dieu_dong_nhan_su_updated_at
on public.dieu_dong_nhan_su;


create trigger trg_dieu_dong_nhan_su_updated_at
before update on public.dieu_dong_nhan_su
for each row
execute function public.set_dieu_dong_nhan_su_updated_at();


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
--
-- Không tạo policy SELECT/INSERT/UPDATE/DELETE với
-- using (true) hoặc with check (true).
--
-- Backend sử dụng Supabase service_role sẽ bypass RLS.
-- ============================================================

alter table public.dieu_dong_nhan_su enable row level security;


-- Xóa các policy public cũ nếu tồn tại
drop policy if exists "dieu_dong_nhan_su_select_all"
on public.dieu_dong_nhan_su;

drop policy if exists "dieu_dong_nhan_su_insert_all"
on public.dieu_dong_nhan_su;

drop policy if exists "dieu_dong_nhan_su_update_all"
on public.dieu_dong_nhan_su;

drop policy if exists "dieu_dong_nhan_su_delete_all"
on public.dieu_dong_nhan_su;


-- ============================================================
-- 7. COMMENTS
-- ============================================================

comment on table public.dieu_dong_nhan_su is
'Ghi nhận điều động nhân sự trong cùng một lệnh sản xuất. Không sửa/xóa phân công nhân sự gốc trong lenh_sx. Cho phép may_goc = may_dieu_dong để ghi nhận điều chỉnh thời gian làm việc như đi làm sớm.';


comment on column public.dieu_dong_nhan_su.ngay_lam_viec is
'Ngày làm việc của lịch điều động.';


comment on column public.dieu_dong_nhan_su.ca is
'Ca làm việc tại thời điểm điều động.';


comment on column public.dieu_dong_nhan_su.ma_lenh_sx is
'Mã lệnh sản xuất mà nhân sự được điều động.';


comment on column public.dieu_dong_nhan_su.ma_nhan_su is
'Mã nhân sự. Phải thống nhất với ma_nhan_su/personnelId trong phan_cong_nhan_su của lenh_sx.';


comment on column public.dieu_dong_nhan_su.vai_tro is
'Snapshot vai trò của nhân sự tại thời điểm điều động.';


comment on column public.dieu_dong_nhan_su.may_goc is
'Snapshot máy/vị trí ban đầu của nhân sự tại thời điểm điều động.';


comment on column public.dieu_dong_nhan_su.may_dieu_dong is
'Máy/vị trí được điều động tới. Có thể giống may_goc khi chỉ điều chỉnh thời gian làm việc, ví dụ nhân sự đi làm sớm.';


comment on column public.dieu_dong_nhan_su.thoi_gian_bat_dau is
'Thời gian bắt đầu điều động/điều chỉnh.';


comment on column public.dieu_dong_nhan_su.thoi_gian_ket_thuc is
'Thời gian kết thúc điều động/điều chỉnh.';


comment on column public.dieu_dong_nhan_su.created_at is
'Thời điểm tạo bản ghi.';


comment on column public.dieu_dong_nhan_su.updated_at is
'Thời điểm cập nhật bản ghi gần nhất.';