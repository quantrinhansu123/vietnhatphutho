-- Chay TOAN BO file nay trong Supabase SQL Editor (1 lan)
-- Sua bang phieu_xuat_nhap_kho thieu cot

create table if not exists public.phieu_xuat_nhap_kho (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.phieu_xuat_nhap_kho
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists ma_phieu text,
  add column if not exists loai_phieu text,
  add column if not exists ngay_phieu date,
  add column if not exists ma_npl text,
  add column if not exists ten_npl text,
  add column if not exists don_vi text,
  add column if not exists so_luong numeric,
  add column if not exists don_gia numeric,
  add column if not exists thanh_tien numeric,
  add column if not exists ly_do text,
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists nhan_su text,
  add column if not exists loai_kho text default 'nvl',
  add column if not exists ma_sp text,
  add column if not exists ten_sp text;

create index if not exists phieu_xuat_nhap_kho_ma_phieu_idx on public.phieu_xuat_nhap_kho (ma_phieu);
create index if not exists phieu_xuat_nhap_kho_ngay_phieu_idx on public.phieu_xuat_nhap_kho (ngay_phieu desc);
create index if not exists phieu_xuat_nhap_kho_loai_phieu_idx on public.phieu_xuat_nhap_kho (loai_phieu);
create index if not exists phieu_xuat_nhap_kho_loai_kho_idx on public.phieu_xuat_nhap_kho (loai_kho);

alter table public.phieu_xuat_nhap_kho enable row level security;

drop policy if exists "phieu_xuat_nhap_kho_select_all" on public.phieu_xuat_nhap_kho;
create policy "phieu_xuat_nhap_kho_select_all"
  on public.phieu_xuat_nhap_kho for select using (true);

drop policy if exists "phieu_xuat_nhap_kho_insert_all" on public.phieu_xuat_nhap_kho;
create policy "phieu_xuat_nhap_kho_insert_all"
  on public.phieu_xuat_nhap_kho for insert with check (true);

drop policy if exists "phieu_xuat_nhap_kho_delete_all" on public.phieu_xuat_nhap_kho;
create policy "phieu_xuat_nhap_kho_delete_all"
  on public.phieu_xuat_nhap_kho for delete using (true);

-- Neu luu phieu bao loi integer voi so thap phan (vd. 0.01), chay them:
-- supabase-phieu-xuat-nhap-kho-so-luong-numeric.sql

-- Reload schema cache PostgREST
notify pgrst, 'reload schema';

-- Neu bang cu co NOT NULL tren ma_sp/ma_npl, chay them:
-- supabase-phieu-xuat-nhap-kho-nullables.sql
