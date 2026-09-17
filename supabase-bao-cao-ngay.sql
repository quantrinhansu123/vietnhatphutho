-- Báo cáo ngày (tổng hợp từ sổ trộn, 1 ngày = 1 báo cáo)
-- Chạy 1 lần trong Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.bao_cao_ngay (
  id uuid primary key default gen_random_uuid(),
  chi_nhanh text not null default 'Phú Thọ',
  ngay date not null,
  -- Nhân sự ca C1 (header "C1: quý, luyên, được, thực" trong ảnh)
  nhan_su_c1 text not null default '',
  -- Nhập thành phẩm: [{ma_hang, so_luong, trong_luong}]
  thanh_pham jsonb not null default '[]'::jsonb,
  -- Phế hồng trong ca: [{loai_phe, so_luong, dot}]
  phe_hong jsonb not null default '[]'::jsonb,
  -- Vật tư: [{ma_nvl, ten_nvl, ton_dau_ngay, nhap_vt, ton_trong_ngay, hao_hut, su_dung}]
  vat_tu jsonb not null default '[]'::jsonb,
  tong_thanh_pham_so_luong numeric not null default 0,
  tong_thanh_pham_trong_luong numeric not null default 0,
  tong_phe numeric not null default 0,
  tong_nhap_vt numeric not null default 0,
  tong_ton_trong_ngay numeric not null default 0,
  tong_hao_hut numeric not null default 0,
  ghi_chu text not null default '',
  -- Soft delete: NULL = đang hoạt động, có giá trị = đã xóa (ẩn khỏi danh sách)
  deleted_at timestamptz null,
  deleted_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1 ngày chỉ 1 báo cáo (bỏ qua các dòng đã xóa mềm)
create unique index if not exists idx_bao_cao_ngay_unique_ngay
  on public.bao_cao_ngay (ngay)
  where deleted_at is null;

create index if not exists idx_bao_cao_ngay_ngay
  on public.bao_cao_ngay (ngay desc);
create index if not exists idx_bao_cao_ngay_deleted_at
  on public.bao_cao_ngay (deleted_at);

create or replace function public.set_bao_cao_ngay_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bao_cao_ngay_updated_at on public.bao_cao_ngay;

create trigger trg_bao_cao_ngay_updated_at
before update on public.bao_cao_ngay
for each row
execute function public.set_bao_cao_ngay_updated_at();

comment on table public.bao_cao_ngay is 'Báo cáo ngày tổng hợp từ sổ trộn (1 ngày = 1 báo cáo, soft delete qua deleted_at).';
comment on column public.bao_cao_ngay.thanh_pham is 'Nhập thành phẩm: [{ma_hang, so_luong, trong_luong}] — gom từ bang_san_pham sổ trộn trong ngày.';
comment on column public.bao_cao_ngay.phe_hong is 'Phế hồng trong ca: [{loai_phe, so_luong, dot}] — gom từ bang_hang_loi sổ trộn trong ngày.';
comment on column public.bao_cao_ngay.vat_tu is 'Vật tư: [{ma_nvl, ten_nvl, ton_dau_ngay, nhap_vt, ton_trong_ngay, hao_hut}] — ton_dau từ ca 12C1/HC1, nhap = Σ lay_trong_kho, ton_trong = ton_dau + nhap - su_dung, hao = ton_dau + nhap - ton_trong.';
comment on column public.bao_cao_ngay.deleted_at is 'Soft delete: NULL = đang hoạt động, có giá trị = đã xóa (ẩn khỏi danh sách, xem lại qua ?includeDeleted=1).';

select 'OK - Đã tạo bảng bao_cao_ngay.' as result;
