-- Chay trong Supabase SQL Editor
-- Them tham chieu lo nhap khi xuat NVL (chon tay lo/gia)

alter table public.phieu_xuat_nhap_kho
  add column if not exists id_dong_nhap_nguon uuid,
  add column if not exists ma_phieu_nhap_nguon text;

create index if not exists phieu_xuat_nhap_kho_ma_npl_loai_idx
  on public.phieu_xuat_nhap_kho (ma_npl, loai_phieu);

create index if not exists phieu_xuat_nhap_kho_id_dong_nhap_nguon_idx
  on public.phieu_xuat_nhap_kho (id_dong_nhap_nguon);

comment on column public.phieu_xuat_nhap_kho.id_dong_nhap_nguon is
  'Id dong phieu nhap NVL ma dong xuat nay tru ton. Null voi nhap hoac xuat cu.';
comment on column public.phieu_xuat_nhap_kho.ma_phieu_nhap_nguon is
  'Ma phieu nhap nguon (de in/hien thi nhanh).';
