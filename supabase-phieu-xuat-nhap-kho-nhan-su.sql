-- Chay neu bang phieu_xuat_nhap_kho co cot nhan_su NOT NULL
-- Dong bo nguoi lap vao nhan_su va dat mac dinh

alter table public.phieu_xuat_nhap_kho
  add column if not exists nhan_su text,
  add column if not exists nguoi_lap text;

update public.phieu_xuat_nhap_kho
set nhan_su = coalesce(nullif(trim(nguoi_lap), ''), 'Hệ thống')
where nhan_su is null or trim(nhan_su) = '';

alter table public.phieu_xuat_nhap_kho
  alter column nhan_su set default 'Hệ thống';

comment on column public.phieu_xuat_nhap_kho.nhan_su is 'Nhan su / nguoi thuc hien phieu.';

notify pgrst, 'reload schema';
