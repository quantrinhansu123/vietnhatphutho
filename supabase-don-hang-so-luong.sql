-- Chay trong Supabase SQL Editor (an toan khi chay lai)
-- Bo sung cot so luong cho bang don_hang neu bang tao truoc do chua co.

alter table public.don_hang
  add column if not exists so_luong numeric,
  add column if not exists so_luong_ton numeric;

comment on column public.don_hang.so_luong is 'So luong dat hang.';
comment on column public.don_hang.so_luong_ton is 'So luong ton kho lien quan don hang.';
