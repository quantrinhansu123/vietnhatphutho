-- Chay lai an toan trong Supabase SQL Editor
-- Nhat ky san xuat / Bang tron vat tu (Bao cao phoi tron)

create table if not exists public.bao_cao_phoi_tron (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.bao_cao_phoi_tron
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists ca text,
  add column if not exists ngay date,
  add column if not exists gio time,
  add column if not exists chi_nhanh text,
  add column if not exists ma_may text,
  add column if not exists ten_may text,
  add column if not exists nhan_su text,
  add column if not exists so_phieu text,
  add column if not exists ky_hieu text default 'QT-16-BM02',
  add column if not exists so_lan integer default 3,
  add column if not exists thuc_te_su_dung numeric,
  add column if not exists ghi_chu text,
  add column if not exists chi_tiet jsonb not null default '[]'::jsonb,
  add column if not exists hinh_anh_theo_lan jsonb not null default '{}'::jsonb;

alter table public.bao_cao_phoi_tron enable row level security;

drop policy if exists "bao_cao_phoi_tron_select_all" on public.bao_cao_phoi_tron;
create policy "bao_cao_phoi_tron_select_all"
  on public.bao_cao_phoi_tron for select using (true);

drop policy if exists "bao_cao_phoi_tron_insert_all" on public.bao_cao_phoi_tron;
create policy "bao_cao_phoi_tron_insert_all"
  on public.bao_cao_phoi_tron for insert with check (true);

drop policy if exists "bao_cao_phoi_tron_update_all" on public.bao_cao_phoi_tron;
create policy "bao_cao_phoi_tron_update_all"
  on public.bao_cao_phoi_tron for update using (true) with check (true);

drop policy if exists "bao_cao_phoi_tron_delete_all" on public.bao_cao_phoi_tron;
create policy "bao_cao_phoi_tron_delete_all"
  on public.bao_cao_phoi_tron for delete using (true);

comment on table public.bao_cao_phoi_tron is 'Bao cao phoi tron vat tu theo ca / may.';
comment on column public.bao_cao_phoi_tron.chi_tiet is
  'Mang dong NVL. Moi phan tu: stt, ma_nvl, ten_vat_tu, lan_su_dung {khoi_luong_me: {lan_1..lan_5: kg}, lan_1..lan_5: [{ma_nvl, ten_vat_tu, don_vi, so_luong, ti_le_phan_tram}]}, tong_nhua_tron.';
comment on column public.bao_cao_phoi_tron.hinh_anh_theo_lan is
  'Anh xac nhan theo lan phoi tron: {lan_1: [{url, public_id}], lan_2: [...], ...}.';
comment on column public.bao_cao_phoi_tron.so_lan is 'So lan phoi tron trong ca (1-5).';
