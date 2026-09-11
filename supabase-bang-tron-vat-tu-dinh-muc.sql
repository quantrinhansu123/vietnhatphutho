-- Bảng trộn vật tư định mức (nhập tay)
-- Phiếu: ngày + tổng trọng lượng + nhiều dòng NVL (chi_tiet jsonb)
-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)

create table if not exists public.bang_tron_vat_tu_dinh_muc (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.bang_tron_vat_tu_dinh_muc
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists ngay date,
  add column if not exists ca text,
  add column if not exists ma_lenh_sx text,
  add column if not exists tong_trong_luong numeric,
  add column if not exists ghi_chu text,
  add column if not exists chi_tiet jsonb not null default '[]'::jsonb,
  -- SP + NVL
  add column if not exists ma_sp text,
  add column if not exists ten_sp text,
  add column if not exists ma_nvl text,
  add column if not exists ten_nvl text,
  add column if not exists dinh_muc numeric,
  add column if not exists don_vi_dinh_muc text default '%',
  add column if not exists ten_phieu text,
  add column if not exists id_phieu_tron_dm_ban_dau uuid;

-- Dữ liệu cũ có thể chưa có ngày. Backfill trước khi bật ràng buộc bắt buộc.
update public.bang_tron_vat_tu_dinh_muc
set ngay = coalesce(ngay, created_at::date, current_date)
where ngay is null;

alter table public.bang_tron_vat_tu_dinh_muc
  alter column ngay set not null;

create index if not exists bang_tron_vat_tu_dinh_muc_ngay_idx
  on public.bang_tron_vat_tu_dinh_muc (ngay desc);

create index if not exists bang_tron_vat_tu_dinh_muc_ma_lenh_sx_idx
  on public.bang_tron_vat_tu_dinh_muc (ma_lenh_sx);

create index if not exists bang_tron_vat_tu_dinh_muc_ngay_ca_idx
  on public.bang_tron_vat_tu_dinh_muc (ngay desc, ca);

create index if not exists bang_tron_vat_tu_dinh_muc_ban_dau_idx
  on public.bang_tron_vat_tu_dinh_muc (id_phieu_tron_dm_ban_dau);

alter table public.bang_tron_vat_tu_dinh_muc enable row level security;

drop policy if exists "bang_tron_vat_tu_dinh_muc_select_all" on public.bang_tron_vat_tu_dinh_muc;
create policy "bang_tron_vat_tu_dinh_muc_select_all"
  on public.bang_tron_vat_tu_dinh_muc for select using (true);

drop policy if exists "bang_tron_vat_tu_dinh_muc_insert_all" on public.bang_tron_vat_tu_dinh_muc;
create policy "bang_tron_vat_tu_dinh_muc_insert_all"
  on public.bang_tron_vat_tu_dinh_muc for insert with check (true);

drop policy if exists "bang_tron_vat_tu_dinh_muc_update_all" on public.bang_tron_vat_tu_dinh_muc;
create policy "bang_tron_vat_tu_dinh_muc_update_all"
  on public.bang_tron_vat_tu_dinh_muc for update using (true) with check (true);

drop policy if exists "bang_tron_vat_tu_dinh_muc_delete_all" on public.bang_tron_vat_tu_dinh_muc;
create policy "bang_tron_vat_tu_dinh_muc_delete_all"
  on public.bang_tron_vat_tu_dinh_muc for delete using (true);

comment on table public.bang_tron_vat_tu_dinh_muc is
  'Phieu tron dinh muc: lenh SX + san pham + dong NVL.';
comment on column public.bang_tron_vat_tu_dinh_muc.ma_lenh_sx is 'Ma lenh san xuat.';
comment on column public.bang_tron_vat_tu_dinh_muc.tong_trong_luong is 'Tong trong luong (kg) cua phieu dinh muc.';
comment on column public.bang_tron_vat_tu_dinh_muc.chi_tiet is
  'Mang SP: [{ma_sp, ten_sp, tong_trong_luong, ghi_chu, nvl:[{ma_nvl, ten_nvl, gia_tri, don_vi, khoi_luong}]}]. khoi_luong = tong_tl * % / 100 (hoac = gia_tri neu don_vi kg). 1 dong = 1 phieu.';
comment on column public.bang_tron_vat_tu_dinh_muc.id_phieu_tron_dm_ban_dau is
  'ID phieu tron dinh muc ban dau. Cac ban thay doi luon tro truc tiep ve ban dau, khong noi chuoi.';
