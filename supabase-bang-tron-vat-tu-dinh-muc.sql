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
  add column if not exists tong_trong_luong numeric,
  add column if not exists ghi_chu text,
  add column if not exists chi_tiet jsonb not null default '[]'::jsonb,
  -- cột cũ (có thể còn sẵn; UI mới không bắt buộc)
  add column if not exists ma_sp text,
  add column if not exists ten_sp text,
  add column if not exists ma_nvl text,
  add column if not exists ten_nvl text,
  add column if not exists dinh_muc numeric,
  add column if not exists don_vi_dinh_muc text default '%';

create index if not exists bang_tron_vat_tu_dinh_muc_ngay_idx
  on public.bang_tron_vat_tu_dinh_muc (ngay desc);

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
  'Bang tron vat tu dinh muc — nhap tay: tong trong luong + dong NVL.';
comment on column public.bang_tron_vat_tu_dinh_muc.tong_trong_luong is 'Tong trong luong (kg) cua phieu dinh muc.';
comment on column public.bang_tron_vat_tu_dinh_muc.chi_tiet is
  'Mang dong NVL: [{ma_nvl, ten_nvl, gia_tri, don_vi}].';
