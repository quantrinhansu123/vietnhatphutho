-- Chay trong Supabase SQL Editor
-- Dat ton dau ky = 100 cho kho NVL va san pham

alter table public.san_pham
  add column if not exists ton_dau_ky numeric,
  add column if not exists nhap_trong_ky numeric,
  add column if not exists xuat_trong_ky numeric;

alter table public.kho_nvl
  add column if not exists ton_dau_ky numeric;

update public.kho_nvl
set ton_dau_ky = 100;

update public.san_pham
set ton_dau_ky = 100;

comment on column public.san_pham.nhap_trong_ky is 'Nhap trong ky.';
comment on column public.san_pham.xuat_trong_ky is 'Xuat trong ky.';
