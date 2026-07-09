-- Nhật ký chạy máy (BM-SX-11)
create extension if not exists pgcrypto;

create table if not exists public.nhat_ky_chay_may (
  id uuid primary key default gen_random_uuid(),
  so_phieu text not null,
  ngay date not null,
  ca text not null,
  ma_may text,
  ten_may text,
  lenh_sx text,
  ma_san_pham text,
  tho_chinh text,
  tho_phu text,
  gio_chay_kh numeric(10,2) not null default 0,
  tong_cuon_ra numeric(14,2) not null default 0,
  tong_thoi_gian_dung_phut numeric(14,2) not null default 0,
  thoi_gian_chay_thuc_te_phut numeric(14,2) not null default 0,
  hieu_suat_thoi_gian_pct numeric(10,2),
  toc_do_dat_dinh_muc_pct numeric(10,2),
  nang_suat_cuon_gio numeric(14,2),
  ghi_chu text,
  chi_tiet jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_nhat_ky_chay_may_so_phieu
  on public.nhat_ky_chay_may (so_phieu);

create index if not exists idx_nhat_ky_chay_may_ngay
  on public.nhat_ky_chay_may (ngay desc);

create index if not exists idx_nhat_ky_chay_may_ma_may
  on public.nhat_ky_chay_may (ma_may);

create index if not exists idx_nhat_ky_chay_may_chi_tiet
  on public.nhat_ky_chay_may using gin (chi_tiet);

create or replace function public.set_nhat_ky_chay_may_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nhat_ky_chay_may_updated_at on public.nhat_ky_chay_may;

create trigger trg_nhat_ky_chay_may_updated_at
before update on public.nhat_ky_chay_may
for each row
execute function public.set_nhat_ky_chay_may_updated_at();

comment on table public.nhat_ky_chay_may is 'Nhật ký chạy máy BM-SX-11 — thợ chính máy điền mỗi 2 giờ, tổng kết hiệu suất máy trong ca.';
comment on column public.nhat_ky_chay_may.chi_tiet is 'Danh sách dòng ghi: stt, thoi_diem_ghi, nhiet_do_gia_nhiet, toc_do_thuc, toc_do_dinh_muc, so_cuon_ra, thoi_gian_dung_phut, ly_do, nguoi_ghi.';
