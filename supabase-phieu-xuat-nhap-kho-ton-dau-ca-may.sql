-- Chay trong Supabase SQL Editor
-- Them cot ton dau ca cua may (nhap tay) cho tung dong phieu xuat/nhap kho NVL,
-- hien thi truoc cot SLCT / SL dinh muc xuat tren phieu xuat NVL.

alter table public.phieu_xuat_nhap_kho
  add column if not exists ton_dau_ca_may numeric;

comment on column public.phieu_xuat_nhap_kho.ton_dau_ca_may is
  'Ton dau ca cua may (nhap tay) cho tung dong NVL, hien thi truoc cot SLCT / SL dinh muc xuat tren phieu xuat NVL.';
