-- Báo cáo đơn cắt lẻ.
-- Phiếu: bao_cao_don_cat_le.
-- Sản phẩm: bao_cao_don_cat_le_san_pham — mỗi dòng một sản phẩm
-- (nguồn, cắt, còn lại), không gom cả danh sách vào một JSON.
-- Cột: ma_amis, ma_amis_cu, ten_san_pham, ten_san_xuat, chi_tiet.
-- chi_tiet chỉ giữ số liệu kèm theo (SL, kg, m², dài, độ li, loại dòng...).
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

create extension if not exists pgcrypto;

create table if not exists public.bao_cao_don_cat_le (
  id uuid primary key default gen_random_uuid(),
  ma_bao_cao text not null,
  ngay date not null,
  ma_lenh text,
  nguoi_lap text,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bao_cao_don_cat_le drop column if exists san_pham;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'bao_cao_don_cat_le_ma_bao_cao_key'
  ) then
    alter table public.bao_cao_don_cat_le
      add constraint bao_cao_don_cat_le_ma_bao_cao_key unique (ma_bao_cao);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists bao_cao_don_cat_le_ngay_idx on public.bao_cao_don_cat_le (ngay desc);

create table if not exists public.bao_cao_don_cat_le_san_pham (
  id uuid primary key default gen_random_uuid(),
  bao_cao_id uuid not null references public.bao_cao_don_cat_le(id) on delete cascade,
  stt integer not null,
  ma_amis text,
  ma_amis_cu text,
  ten_san_pham text,
  ten_san_xuat text,
  chi_tiet jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bao_cao_don_cat_le_san_pham_bao_cao_idx
  on public.bao_cao_don_cat_le_san_pham (bao_cao_id, stt);
