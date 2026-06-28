-- Chay neu bang san_pham da ton tai — them cot ton dau ky

alter table public.san_pham
  add column if not exists ton_dau_ky numeric;

comment on column public.san_pham.ton_dau_ky is 'Ton dau ky san pham.';
