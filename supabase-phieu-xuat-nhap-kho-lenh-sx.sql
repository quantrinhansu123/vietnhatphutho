-- Chay trong Supabase SQL Editor
-- Bang lien ket: lenh SX (ma_lenh_sx, ngay, ca) da duoc chon trong phieu xuat kho NVL nao.
-- Dung de an cac lenh SX da xuat khoi picker "Ma don hang / Lenh SX", va khoi phuc lai
-- dung lua chon khi sua phieu tu Lich su xuat nhap kho.

create table if not exists public.phieu_xuat_nhap_kho_lenh_sx (
  id bigint generated always as identity primary key,
  ma_phieu text not null,
  ma_lenh_sx text not null,
  ngay date not null,
  ca text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists phieu_xuat_nhap_kho_lenh_sx_key_idx
  on public.phieu_xuat_nhap_kho_lenh_sx (ma_lenh_sx, ngay, ca);

create index if not exists phieu_xuat_nhap_kho_lenh_sx_ma_phieu_idx
  on public.phieu_xuat_nhap_kho_lenh_sx (ma_phieu);

comment on table public.phieu_xuat_nhap_kho_lenh_sx is
  'Lien ket phieu xuat kho NVL voi cac lenh SX (ma_lenh_sx, ngay, ca) da chon. 1 dong / lenh SX / phieu.';
