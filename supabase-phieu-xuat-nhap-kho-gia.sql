-- Chay trong Supabase SQL Editor — them gia va thanh tien cho phieu xuat nhap kho

alter table public.phieu_xuat_nhap_kho
  add column if not exists don_gia numeric,
  add column if not exists thanh_tien numeric;

comment on column public.phieu_xuat_nhap_kho.don_gia is 'Don gia tung dong.';
comment on column public.phieu_xuat_nhap_kho.thanh_tien is 'Thanh tien = don_gia * so_luong.';
