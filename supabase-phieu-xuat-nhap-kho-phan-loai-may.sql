-- Chay trong Supabase SQL Editor (an toan khi chay lai)
-- Luu may va phan loai tren tung dong phieu xuat kho NVL.

alter table public.phieu_xuat_nhap_kho
  add column if not exists may text,
  add column if not exists phan_loai_nvl text;

-- Theo quyet dinh nghiep vu: du lieu cu khong suy luan nguoc may/phan loai.
update public.phieu_xuat_nhap_kho
set phan_loai_nvl = 'chua_phan_loai'
where coalesce(loai_kho, 'nvl') <> 'san_pham'
  and phan_loai_nvl is null;

alter table public.phieu_xuat_nhap_kho
  drop constraint if exists phieu_xuat_nhap_kho_phan_loai_nvl_check;

create index if not exists phieu_xuat_nhap_kho_may_phan_loai_idx
  on public.phieu_xuat_nhap_kho (ma_phieu, may, phan_loai_nvl);

comment on column public.phieu_xuat_nhap_kho.may is
  'May san xuat cua dong NVL, lay tu lenh san xuat gan voi phieu tron dinh muc.';
comment on column public.phieu_xuat_nhap_kho.phan_loai_nvl is
  'Phan loai dong NVL: nvl_chinh, nvl_phu hoac chua_phan_loai.';
