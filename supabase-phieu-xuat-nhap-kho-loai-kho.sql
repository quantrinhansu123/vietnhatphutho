-- Chay neu bang phieu_xuat_nhap_kho da ton tai — them phan loai kho NVL / San pham

alter table public.phieu_xuat_nhap_kho
  add column if not exists loai_kho text default 'nvl',
  add column if not exists ma_sp text,
  add column if not exists ten_sp text;

create index if not exists phieu_xuat_nhap_kho_loai_kho_idx on public.phieu_xuat_nhap_kho (loai_kho);

comment on column public.phieu_xuat_nhap_kho.loai_kho is 'nvl hoac san_pham.';
comment on column public.phieu_xuat_nhap_kho.ma_sp is 'Ma san pham khi loai_kho = san_pham.';
comment on column public.phieu_xuat_nhap_kho.ten_sp is 'Ten san pham khi loai_kho = san_pham.';
