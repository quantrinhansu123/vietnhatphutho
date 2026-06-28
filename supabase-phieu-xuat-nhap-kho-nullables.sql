-- Chay trong Supabase SQL Editor
-- Cho phep ma_sp / ma_npl de trong khi loai_kho = nvl hoac san_pham

alter table public.phieu_xuat_nhap_kho
  alter column ma_sp drop not null;

alter table public.phieu_xuat_nhap_kho
  alter column ma_npl drop not null;

alter table public.phieu_xuat_nhap_kho
  alter column ten_sp drop not null;

alter table public.phieu_xuat_nhap_kho
  alter column ten_npl drop not null;

alter table public.phieu_xuat_nhap_kho
  alter column ma_sp set default '',
  alter column ma_npl set default '',
  alter column ten_sp set default '',
  alter column ten_npl set default '';

notify pgrst, 'reload schema';
