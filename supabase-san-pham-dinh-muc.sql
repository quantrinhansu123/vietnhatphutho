-- Chay lai an toan trong Supabase SQL Editor
-- Bo sung cot dinh muc san pham (theo bang DINH MUC SAN PHAM)

alter table public.san_pham
  add column if not exists ma_amis text,
  add column if not exists tong_trong_luong numeric,
  add column if not exists kho_cuon numeric,
  add column if not exists chieu_dai_cuon numeric,
  add column if not exists trong_luong_loi numeric,
  add column if not exists trong_luong_tui numeric,
  add column if not exists trong_luong_nhua numeric;

comment on column public.san_pham.ma_amis is 'Ma san pham tren he thong AMIS.';
comment on column public.san_pham.tong_trong_luong is 'Tong trong luong thanh pham (kg).';
comment on column public.san_pham.kho_cuon is 'Kho cuon (m).';
comment on column public.san_pham.chieu_dai_cuon is 'Chieu dai met / cuon (m).';
comment on column public.san_pham.trong_luong_loi is 'Trong luong loi (kg).';
comment on column public.san_pham.trong_luong_tui is 'Trong luong tui (kg).';
comment on column public.san_pham.trong_luong_nhua is 'Trong luong nhua + phu gia thuc dung (kg).';

-- Du lieu mau: chay tiep file supabase-san-pham-dinh-muc-seed.sql
