-- Luu trong luong kg da quy doi de mau in va lan in lai hien thi cung mot gia tri.
alter table public.phieu_xuat_nhap_kho
  add column if not exists trong_luong_kg numeric;

comment on column public.phieu_xuat_nhap_kho.trong_luong_kg is
  'Trong luong kg da quy doi cua dong NVL, uu tien he so tu phieu tron dinh muc.';
