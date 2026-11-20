-- Sổ NVL mới: header `phieu_nhap_kho_nvl` + dòng `nhap_kho_nvl` (dùng chung nhập/xuất qua loai_phieu).
-- Kiểm soát: trạng thái nháp → đã duyệt → hủy; khóa sửa dòng sau khi duyệt; kiểm tồn khi duyệt phiếu xuất;
-- view tồn theo kho / mã / tên SX / mã luồng. Idempotent, chạy lại được. Hai bảng đang rỗng khi viết file này.
-- KHÔNG ràng buộc cặp mã luồng (SX01→SX02...): người dùng tự chọn.

begin;

-- 1) Danh mục mã luồng (MN01, SX01, HM05...). Chỉ là nhãn để chọn/lọc/báo cáo.
create table if not exists public.ma_luong_nvl (
  ma text primary key,
  ten text not null default '',
  kho_mac_dinh text,
  phan_loai text,
  ghi_chu text,
  hoat_dong boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Header phiếu
alter table public.phieu_nhap_kho_nvl
  alter column id set default gen_random_uuid(),
  add column if not exists ma_phieu text,
  add column if not exists trang_thai text not null default 'nhap',
  add column if not exists ngay_phieu date,
  add column if not exists dot_so text,
  add column if not exists ca text,
  add column if not exists may text,
  add column if not exists loai_sp_chay text,
  add column if not exists kho_nguon text,
  add column if not exists kho_dich text,
  add column if not exists ma_luong text,
  add column if not exists phieu_goc_id uuid references public.phieu_nhap_kho_nvl(id),
  add column if not exists ly_do text,
  add column if not exists ghi_chu text,
  add column if not exists nguoi_duyet text,
  add column if not exists ngay_duyet timestamptz,
  add column if not exists log jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.phieu_nhap_kho_nvl
  alter column ngay_gio set default now();

-- `kho` cũ giữ nguyên; phiếu nhập coi kho_dich = kho, phiếu xuất coi kho_nguon = kho nếu chưa nhập riêng.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'phieu_nhap_kho_nvl_loai_chk') then
    alter table public.phieu_nhap_kho_nvl
      add constraint phieu_nhap_kho_nvl_loai_chk check (loai_phieu is null or loai_phieu in ('nhap', 'xuat'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'phieu_nhap_kho_nvl_trang_thai_chk') then
    alter table public.phieu_nhap_kho_nvl
      add constraint phieu_nhap_kho_nvl_trang_thai_chk check (trang_thai in ('nhap', 'da_duyet', 'huy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'phieu_nhap_kho_nvl_loai_sp_chay_chk') then
    alter table public.phieu_nhap_kho_nvl
      add constraint phieu_nhap_kho_nvl_loai_sp_chay_chk check (loai_sp_chay is null or loai_sp_chay in ('dac', 'song', 'rong'));
  end if;
end $$;

-- Khóa ngoại cần ràng buộc unique thật (không dùng được partial index). NULL vẫn cho phép nhiều dòng.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'phieu_nhap_kho_nvl_ma_phieu_key') then
    alter table public.phieu_nhap_kho_nvl add constraint phieu_nhap_kho_nvl_ma_phieu_key unique (ma_phieu);
  end if;
end $$;
create index if not exists phieu_nhap_kho_nvl_ngay_idx on public.phieu_nhap_kho_nvl (ngay_phieu desc);
create index if not exists phieu_nhap_kho_nvl_trang_thai_idx on public.phieu_nhap_kho_nvl (trang_thai);
create index if not exists phieu_nhap_kho_nvl_dot_may_idx on public.phieu_nhap_kho_nvl (dot_so, may);
create index if not exists phieu_nhap_kho_nvl_goc_idx on public.phieu_nhap_kho_nvl (phieu_goc_id);

-- 3) Dòng chi tiết
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'nhap_kho_nvl' and column_name = 'CP_phu') then
    alter table public.nhap_kho_nvl rename column "CP_phu" to cp_phu;
  end if;
end $$;

alter table public.nhap_kho_nvl
  alter column id set default gen_random_uuid(),
  add column if not exists id_danh_muc uuid,
  add column if not exists phan_loai_nvl text,
  add column if not exists trong_luong_kg numeric,
  add column if not exists thanh_tien numeric,
  add column if not exists ma_luong text,
  add column if not exists id_dong_nhap_nguon uuid references public.nhap_kho_nvl(id),
  add column if not exists stt integer,
  add column if not exists created_at timestamptz not null default now();

alter table public.nhap_kho_nvl
  alter column ngay_lap set default now();

-- `phieu_nk` = ma_phieu của header. Bảng rỗng nên thêm khóa ngoại an toàn.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nhap_kho_nvl_phieu_nk_fk') then
    alter table public.nhap_kho_nvl
      add constraint nhap_kho_nvl_phieu_nk_fk
      foreign key (phieu_nk) references public.phieu_nhap_kho_nvl (ma_phieu)
      on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nhap_kho_nvl_so_luong_chk') then
    alter table public.nhap_kho_nvl
      add constraint nhap_kho_nvl_so_luong_chk check (so_luong is null or so_luong >= 0);
  end if;
end $$;

create index if not exists nhap_kho_nvl_phieu_idx on public.nhap_kho_nvl (phieu_nk);
create index if not exists nhap_kho_nvl_ma_kho_idx on public.nhap_kho_nvl (ten_kho, ma_nvl, ten_sx);
create index if not exists nhap_kho_nvl_danh_muc_idx on public.nhap_kho_nvl (id_danh_muc);
create index if not exists nhap_kho_nvl_nguon_idx on public.nhap_kho_nvl (id_dong_nhap_nguon);

-- 4) Khóa sửa/xóa dòng khi phiếu không còn ở trạng thái nháp.
create or replace function public.nvl_khoa_dong_khi_da_duyet()
returns trigger language plpgsql as $$
declare
  v_ma text := coalesce(case when tg_op = 'DELETE' then old.phieu_nk else new.phieu_nk end, '');
  v_tt text;
begin
  select trang_thai into v_tt from public.phieu_nhap_kho_nvl where ma_phieu = v_ma;
  if v_tt is not null and v_tt <> 'nhap' then
    raise exception 'Phiếu % đã % — không thể sửa dòng chi tiết', v_ma, v_tt;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists nvl_khoa_dong_khi_da_duyet on public.nhap_kho_nvl;
create trigger nvl_khoa_dong_khi_da_duyet
  before insert or update or delete on public.nhap_kho_nvl
  for each row execute function public.nvl_khoa_dong_khi_da_duyet();

-- Header: cấm sửa nội dung khi đã duyệt/hủy (chỉ cho đổi trạng thái hợp lệ + log).
create or replace function public.nvl_khoa_header()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.trang_thai <> 'nhap' then
    if not (old.trang_thai = 'da_duyet' and new.trang_thai = 'huy')
       and (to_jsonb(new) - 'log' - 'updated_at') is distinct from (to_jsonb(old) - 'log' - 'updated_at') then
      raise exception 'Phiếu % đã % — chỉ được hủy, không được sửa', old.ma_phieu, old.trang_thai;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists nvl_khoa_header on public.phieu_nhap_kho_nvl;
create trigger nvl_khoa_header
  before update on public.phieu_nhap_kho_nvl
  for each row execute function public.nvl_khoa_header();

-- 5) View tồn: chỉ tính phiếu đã duyệt. Nhập cộng vào kho đích (hoặc `kho`), xuất trừ ở kho nguồn (hoặc `kho`).
create or replace view public.v_ton_kho_nvl as
select
  d.ten_kho,
  d.ma_nvl,
  coalesce(d.ten_sx, '') as ten_sx,
  coalesce(d.ma_luong, '') as ma_luong,
  max(d.don_vi) as don_vi,
  sum(case when p.loai_phieu = 'nhap' then coalesce(d.so_luong, 0) else 0 end) as tong_nhap,
  sum(case when p.loai_phieu = 'xuat' then coalesce(d.so_luong, 0) else 0 end) as tong_xuat,
  sum(case when p.loai_phieu = 'nhap' then coalesce(d.so_luong, 0) else -coalesce(d.so_luong, 0) end) as ton,
  sum(case when p.loai_phieu = 'nhap' then coalesce(d.trong_luong_kg, 0) else -coalesce(d.trong_luong_kg, 0) end) as ton_kg
from public.nhap_kho_nvl d
join public.phieu_nhap_kho_nvl p on p.ma_phieu = d.phieu_nk
where p.trang_thai = 'da_duyet'
group by d.ten_kho, d.ma_nvl, coalesce(d.ten_sx, ''), coalesce(d.ma_luong, '');

-- 6) Duyệt phiếu: kiểm tồn khi xuất, rồi chuyển da_duyet và ghi log.
create or replace function public.duyet_phieu_nvl(p_id uuid, p_nguoi text)
returns void language plpgsql as $$
declare
  v public.phieu_nhap_kho_nvl%rowtype;
  r record;
begin
  select * into v from public.phieu_nhap_kho_nvl where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu'; end if;
  if v.trang_thai <> 'nhap' then raise exception 'Phiếu % không ở trạng thái nháp', v.ma_phieu; end if;
  if v.ma_phieu is null then raise exception 'Phiếu chưa có mã phiếu'; end if;
  if v.loai_phieu is null then raise exception 'Phiếu chưa có loại phiếu'; end if;
  if not exists (select 1 from public.nhap_kho_nvl where phieu_nk = v.ma_phieu) then
    raise exception 'Phiếu % chưa có dòng chi tiết', v.ma_phieu;
  end if;

  if v.loai_phieu = 'xuat' then
    for r in
      select g.ten_kho, g.ma_nvl, g.ten_sx, g.can_xuat,
             coalesce((select sum(t.ton) from public.v_ton_kho_nvl t
                       where t.ten_kho is not distinct from g.ten_kho and t.ma_nvl = g.ma_nvl
                         and t.ten_sx = g.ten_sx), 0) as dang_ton
      from (
        select d.ten_kho, d.ma_nvl, coalesce(d.ten_sx, '') as ten_sx, sum(coalesce(d.so_luong, 0)) as can_xuat
        from public.nhap_kho_nvl d where d.phieu_nk = v.ma_phieu
        group by d.ten_kho, d.ma_nvl, coalesce(d.ten_sx, '')
      ) g
    loop
      if r.can_xuat > r.dang_ton then
        raise exception 'Vượt tồn: % / % tại kho % — cần %, còn %', r.ma_nvl, r.ten_sx, r.ten_kho, r.can_xuat, r.dang_ton;
      end if;
    end loop;
  end if;

  update public.phieu_nhap_kho_nvl
     set trang_thai = 'da_duyet', nguoi_duyet = p_nguoi, ngay_duyet = now(),
         log = log || jsonb_build_array(jsonb_build_object('hanh_dong', 'duyet', 'nguoi', p_nguoi, 'luc', now()))
   where id = p_id;
end $$;

-- 7) Hủy phiếu: nháp hoặc đã duyệt → huy. Phiếu hủy không còn tính vào view tồn.
create or replace function public.huy_phieu_nvl(p_id uuid, p_nguoi text, p_ly_do text)
returns void language plpgsql as $$
begin
  update public.phieu_nhap_kho_nvl
     set trang_thai = 'huy',
         log = log || jsonb_build_array(jsonb_build_object('hanh_dong', 'huy', 'nguoi', p_nguoi, 'ly_do', p_ly_do, 'luc', now()))
   where id = p_id and trang_thai in ('nhap', 'da_duyet');
  if not found then raise exception 'Không hủy được phiếu (không tồn tại hoặc đã hủy)'; end if;
end $$;

-- 8) RLS: bật, không tạo policy → chỉ service_role (server.ts) truy cập; anon bị chặn.
alter table public.phieu_nhap_kho_nvl enable row level security;
alter table public.nhap_kho_nvl enable row level security;
alter table public.ma_luong_nvl enable row level security;

commit;
