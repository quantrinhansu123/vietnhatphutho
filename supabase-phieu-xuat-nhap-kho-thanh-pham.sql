-- Cot bo sung tren phieu_xuat_nhap_kho cho kho thanh pham
-- (so_m2, so_m_dai, dia_chi, so_tron_ids). Idempotent.

alter table public.phieu_xuat_nhap_kho
  add column if not exists so_m2 numeric,
  add column if not exists so_m_dai numeric,
  add column if not exists dia_chi text,
  add column if not exists so_tron_ids text[];

comment on column public.phieu_xuat_nhap_kho.so_m2 is 'Quy doi m2 cua dong thanh pham.';
comment on column public.phieu_xuat_nhap_kho.so_m_dai is 'Quy doi met dai cua dong thanh pham.';
comment on column public.phieu_xuat_nhap_kho.dia_chi is 'Dia chi giao/nhan tren phieu nhap thanh pham.';
comment on column public.phieu_xuat_nhap_kho.so_tron_ids is 'Danh sach id so tron nguon cua phieu nhap thanh pham.';

create index if not exists phieu_xuat_nhap_kho_so_m2_idx
  on public.phieu_xuat_nhap_kho (so_m2)
  where so_m2 is not null;
