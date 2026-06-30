-- Phiếu báo dừng máy
create extension if not exists pgcrypto;

create table if not exists public.phieu_bao_dung_may (
  id uuid primary key default gen_random_uuid(),
  so_phieu text not null,
  ngay date not null,
  ca text not null,
  ma_may text,
  ten_may text,
  nguoi_lap text,
  lenh_sx_lien_quan text,
  tong_thoi_gian_dung_phut numeric(14,2) not null default 0,
  tong_cuon_anh_huong numeric(14,2) not null default 0,
  ghi_chu_chung text,
  chi_tiet jsonb not null default '[]'::jsonb,
  nguoi_lap_ky text,
  truong_ca_ky text,
  bo_phan_ky text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_phieu_bao_dung_may_so_phieu
  on public.phieu_bao_dung_may (so_phieu);

create index if not exists idx_phieu_bao_dung_may_ngay
  on public.phieu_bao_dung_may (ngay desc);

create index if not exists idx_phieu_bao_dung_may_ma_may
  on public.phieu_bao_dung_may (ma_may);

create index if not exists idx_phieu_bao_dung_may_chi_tiet
  on public.phieu_bao_dung_may using gin (chi_tiet);

create or replace function public.set_phieu_bao_dung_may_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_phieu_bao_dung_may_updated_at on public.phieu_bao_dung_may;

create trigger trg_phieu_bao_dung_may_updated_at
before update on public.phieu_bao_dung_may
for each row
execute function public.set_phieu_bao_dung_may_updated_at();

comment on table public.phieu_bao_dung_may is 'Phiếu báo dừng máy — ghi nhận thời gian dừng và lý do theo ca.';
comment on column public.phieu_bao_dung_may.chi_tiet is 'Danh sách dòng: stt, thoi_gian_bat_dau, thoi_gian_chay_lai, tong_thoi_gian_dung_phut, ly_do_dung_may, so_cuon_anh_huong, nguoi_xac_nhan, ghi_chu.';
