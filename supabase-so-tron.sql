-- So tron ca (cong nhan cuoi ngay) - chi nhanh Phu Tho
-- 1 phieu = 1 ngay + 1 may + 1 ca, gom nhieu lenh SX
create extension if not exists pgcrypto;

create table if not exists public.so_tron (
  id uuid primary key default gen_random_uuid(),
  chi_nhanh text not null default 'Phú Thọ',
  ngay date not null,
  ma_may text not null default '',
  ten_may text not null default '',
  ca text not null default '',
  nhan_su text not null default '',
  nhan_su_chi_tiet jsonb not null default '[]'::jsonb,
  lenh_sx jsonb not null default '[]'::jsonb,
  coi_tron_mau jsonb not null default '[]'::jsonb,
  bang_nvl jsonb not null default '[]'::jsonb,
  bang_san_pham jsonb not null default '[]'::jsonb,
  bang_hang_loi jsonb not null default '[]'::jsonb,
  bang_ban_giao jsonb not null default '[]'::jsonb,
  ghi_chu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chong trung: 1 may + 1 ngay + 1 ca chi 1 so
create unique index if not exists idx_so_tron_unique_may_ngay_ca
  on public.so_tron (ma_may, ngay, ca);

create index if not exists idx_so_tron_ngay
  on public.so_tron (ngay desc);
create index if not exists idx_so_tron_ma_may
  on public.so_tron (ma_may);
create index if not exists idx_so_tron_lenh_sx
  on public.so_tron using gin (lenh_sx);

create or replace function public.set_so_tron_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_so_tron_updated_at on public.so_tron;

create trigger trg_so_tron_updated_at
before update on public.so_tron
for each row
execute function public.set_so_tron_updated_at();

comment on table public.so_tron is 'So tron ca cua cong nhan cuoi ngay (Phu Tho): ngay + may + ca, nhieu lenh SX.';
comment on column public.so_tron.lenh_sx is 'Danh sach lenh SX: [{id, ma_lenh}]';
comment on column public.so_tron.coi_tron_mau is 'Snapshot coi tron mau tu bang_tron_vat_tu_dinh_muc: [{ma_lenh_sx, ma_sp, ten_sp, dinh_luong_coi, nvl: [{ma_nvl, ten_nvl, dvt, gia_tri}]}]';
comment on column public.so_tron.bang_nvl is 'Bang 1 NVL tron thuc te: [{ma_nvl, ten_nvl, dvt, lan: number[], tong}] - tu dong fill NVL theo phieu tron';
comment on column public.so_tron.bang_san_pham is 'Bang 2 san pham: [{ma_lenh_sx, ma_sp, ten_sp, so_luong, dinh_muc, trong_luong, ghi_chu}]';
comment on column public.so_tron.bang_hang_loi is 'Bang 3 hang loi hong: [{ten_loi, so_luong_kg}]';
comment on column public.so_tron.bang_ban_giao is 'Bang 4 nhua ban giao ca sau: [{ma_nvl, ten_nvl, lay_trong_kho, ton_dau_ca, tong_su_dung, ton_cuoi_ca}] - ton_cuoi = lay_trong_kho + ton_dau_ca - tong_su_dung';
