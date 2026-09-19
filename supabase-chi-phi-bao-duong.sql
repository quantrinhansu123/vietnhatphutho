-- ============================================================
-- BẢNG CHI PHÍ SỬA CHỮA / BẢO DƯỠNG & VẬT TƯ SỬ DỤNG THEO THÁNG VÀ MÁY
-- Phục vụ màn hình QC -> Chi phí bảo dưỡng (/chi-phi-bao-duong)
-- Mỗi dòng = 1 máy x 1 tháng (ma_may đặc biệt: CHUNG_CTY, XE_NANG).
-- Tổng hợp tháng = SUM theo (thang, nam), dòng xanh lá = tháng trước.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.chi_phi_bao_duong (
  id uuid primary key default gen_random_uuid(),
  thang integer not null check (thang between 1 and 12),
  nam integer not null check (nam between 1 and 2999),
  ma_may text not null default '',
  ten_may text not null default '',
  chi_phi_sua_chua numeric(16,0) not null default 0 check (chi_phi_sua_chua >= 0),
  sua_chua_ghi_chu text not null default '',
  chi_phi_vat_tu numeric(16,0) not null default 0 check (chi_phi_vat_tu >= 0),
  vat_tu_ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thang, nam, ma_may)
);

-- Thêm cột nếu bảng cũ đã tồn tại (idempotent)
alter table public.chi_phi_bao_duong
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists ma_may text,
  add column if not exists ten_may text,
  add column if not exists chi_phi_sua_chua numeric(16,0),
  add column if not exists sua_chua_ghi_chu text,
  add column if not exists chi_phi_vat_tu numeric(16,0),
  add column if not exists vat_tu_ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Index tra cứu theo tháng/năm + máy
create index if not exists idx_chi_phi_bao_duong_nam_thang
  on public.chi_phi_bao_duong (nam, thang);

create index if not exists idx_chi_phi_bao_duong_ma_may
  on public.chi_phi_bao_duong (ma_may);

create index if not exists idx_chi_phi_bao_duong_created_at
  on public.chi_phi_bao_duong (created_at desc);

-- RLS (mở toàn quyền như các bảng chi phí khác)
alter table public.chi_phi_bao_duong enable row level security;

drop policy if exists "chi_phi_bao_duong_select_all" on public.chi_phi_bao_duong;
create policy "chi_phi_bao_duong_select_all"
  on public.chi_phi_bao_duong for select
  using (true);

drop policy if exists "chi_phi_bao_duong_insert_all" on public.chi_phi_bao_duong;
create policy "chi_phi_bao_duong_insert_all"
  on public.chi_phi_bao_duong for insert
  with check (true);

drop policy if exists "chi_phi_bao_duong_update_all" on public.chi_phi_bao_duong;
create policy "chi_phi_bao_duong_update_all"
  on public.chi_phi_bao_duong for update
  using (true)
  with check (true);

drop policy if exists "chi_phi_bao_duong_delete_all" on public.chi_phi_bao_duong;
create policy "chi_phi_bao_duong_delete_all"
  on public.chi_phi_bao_duong for delete
  using (true);

comment on table public.chi_phi_bao_duong is 'Chi phí sửa chữa/bảo dưỡng & vật tư sử dụng theo tháng và máy (QC).';

-- ============================================================
-- MIGRATION 2 (2026-09): nhập theo NGÀY + chi tiết từng dòng nội dung-giá
-- Mỗi dòng = 1 ngày x 1 máy, chi_tiet JSONB chứa 2 mảng dòng.
-- ============================================================

alter table public.chi_phi_bao_duong
  add column if not exists ngay date,
  add column if not exists chi_tiet jsonb not null default '{"sua_chua_items":[],"vat_tu_items":[]}'::jsonb;

-- Backfill ngày = mùng 1 của tháng cũ cho các dòng chưa có ngày
update public.chi_phi_bao_duong
set ngay = make_date(nam, thang, 1)
where ngay is null and thang between 1 and 12 and nam between 1 and 2999;

-- Ràng buộc duy nhất mới theo ngày + máy (giữ unique cũ để tương thích)
drop index if exists uq_chi_phi_bao_duong_ngay_ma_may;
create unique index if not exists uq_chi_phi_bao_duong_ngay_ma_may
  on public.chi_phi_bao_duong (ngay, ma_may);

create index if not exists idx_chi_phi_bao_duong_ngay
  on public.chi_phi_bao_duong (ngay desc);

-- ============================================================
-- MIGRATION 3 (2026-09): mỗi lần Thêm mới = 1 dòng mới
-- Bỏ unique (thang,nam,ma_may) và unique (ngay,ma_may) để cho phép
-- nhiều dòng cùng máy cùng ngày. Sửa/Xóa làm theo từng id dòng.
-- ============================================================

alter table public.chi_phi_bao_duong
  drop constraint if exists chi_phi_bao_duong_thang_nam_ma_may_key;

drop index if exists uq_chi_phi_bao_duong_ngay_ma_may;

create index if not exists idx_chi_phi_bao_duong_ngay_ma_may
  on public.chi_phi_bao_duong (ngay desc, ma_may);
