-- Chay trong Supabase SQL Editor
-- Bang lien ket: phieu tron dinh muc da duoc chon trong phieu xuat kho NVL nao.
-- Ten bang cu duoc giu lai de migration tuong thich du lieu hien co.

create table if not exists public.phieu_xuat_nhap_kho_lenh_sx (
  id bigint generated always as identity primary key,
  ma_phieu text not null,
  dinh_muc_id uuid,
  ten_phieu text,
  ma_lenh_sx text not null,
  ngay date not null,
  ca text not null default '',
  created_at timestamptz not null default now()
);

alter table public.phieu_xuat_nhap_kho_lenh_sx
  add column if not exists dinh_muc_id uuid,
  add column if not exists ten_phieu text;

create index if not exists phieu_xuat_nhap_kho_dinh_muc_id_idx
  on public.phieu_xuat_nhap_kho_lenh_sx (dinh_muc_id);

create index if not exists phieu_xuat_nhap_kho_lenh_sx_key_idx
  on public.phieu_xuat_nhap_kho_lenh_sx (ma_lenh_sx, ngay, ca);

create index if not exists phieu_xuat_nhap_kho_lenh_sx_ma_phieu_idx
  on public.phieu_xuat_nhap_kho_lenh_sx (ma_phieu);

comment on table public.phieu_xuat_nhap_kho_lenh_sx is
  'Lien ket phieu xuat kho NVL voi cac phieu tron dinh muc da chon. 1 dong / phieu dinh muc / phieu xuat kho.';
