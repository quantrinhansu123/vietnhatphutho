-- Chi chay file nay NEU bang san_pham da ton tai tu truoc.
-- Neu chua co bang san_pham, hay chay supabase-san-pham.sql thay vi file nay.

alter table public.san_pham
  add column if not exists npl_phan_tram jsonb not null default '[]'::jsonb;

comment on column public.san_pham.npl_phan_tram is
  'Danh sach NPL can thiet va ty le phan tram. VD: [{"ma_npl":"NPL-001","ten_npl":"Mang PE","phan_tram":40}]';
