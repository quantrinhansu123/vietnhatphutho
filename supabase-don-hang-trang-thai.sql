-- Chay trong Supabase SQL Editor (an toan khi chay lai)

alter table public.don_hang
  add column if not exists trang_thai text default 'Chờ sx';

comment on column public.don_hang.trang_thai is 'Trang thai don hang: Cho sx, Dang sx, Hoan thanh, Huy.';
