-- Add ton_kho column to san_pham table
alter table public.san_pham
  add column if not exists ton_kho numeric default 0 not null;

comment on column public.san_pham.ton_kho is 'Tồn kho hiện tại của sản phẩm.';
