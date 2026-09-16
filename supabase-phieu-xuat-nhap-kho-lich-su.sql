-- Chay trong Supabase SQL Editor
-- Lich su sua phieu XUAT kho NVL: moi lan PUT thanh cong luu 1 row snapshot
-- (toan bo dong cu + toan bo dong moi) de man hinh xem diff cu/moi.
-- An toan khi chay lai.

create table if not exists public.phieu_xuat_nhap_kho_lich_su (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ma_phieu text not null,
  loai_phieu text,
  loai_kho text,
  ngay_phieu date,
  ca text,
  nguoi_sua text,
  snapshot_cu jsonb not null default '[]'::jsonb,
  snapshot_moi jsonb not null default '[]'::jsonb
);

create index if not exists phieu_xuat_nhap_kho_lich_su_ma_phieu_idx
  on public.phieu_xuat_nhap_kho_lich_su (ma_phieu);
create index if not exists phieu_xuat_nhap_kho_lich_su_created_at_idx
  on public.phieu_xuat_nhap_kho_lich_su (created_at desc);

alter table public.phieu_xuat_nhap_kho_lich_su enable row level security;

drop policy if exists "phieu_xuat_nhap_kho_lich_su_select_all" on public.phieu_xuat_nhap_kho_lich_su;
create policy "phieu_xuat_nhap_kho_lich_su_select_all"
  on public.phieu_xuat_nhap_kho_lich_su for select
  using (true);

drop policy if exists "phieu_xuat_nhap_kho_lich_su_insert_all" on public.phieu_xuat_nhap_kho_lich_su;
create policy "phieu_xuat_nhap_kho_lich_su_insert_all"
  on public.phieu_xuat_nhap_kho_lich_su for insert
  with check (true);

comment on table public.phieu_xuat_nhap_kho_lich_su is 'Lich su sua phieu xuat kho NVL — moi row la 1 lan sua (snapshot dong cu + dong moi).';
comment on column public.phieu_xuat_nhap_kho_lich_su.ma_phieu is 'Ma phieu duoc sua.';
comment on column public.phieu_xuat_nhap_kho_lich_su.nguoi_sua is 'Nguoi thuc hien lan sua (nguoi lap moi nhap tren form sua).';
comment on column public.phieu_xuat_nhap_kho_lich_su.snapshot_cu is 'Toan bo dong phieu TRUOC khi sua (select *).';
comment on column public.phieu_xuat_nhap_kho_lich_su.snapshot_moi is 'Toan bo dong phieu SAU khi sua (ket qua insert).';
