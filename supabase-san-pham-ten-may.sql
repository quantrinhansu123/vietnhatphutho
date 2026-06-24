alter table public.san_pham
  add column if not exists ten_may_san_xuat text;

comment on column public.san_pham.ten_may_san_xuat is 'Ten may san xuat tuong ung voi ma_sp.';
