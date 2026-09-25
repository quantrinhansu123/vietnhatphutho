-- Tồn máy tách khỏi tồn kho: row kho ma_may IS NULL; row máy ma_may IS NOT NULL và ten_kho = ''.
-- Không nhét máy vào loai_kho / ten_kho. Chạy an toàn khi chạy lại.

alter table public.nhap_kho
  add column if not exists ma_may text,
  add column if not exists ten_may text;

create index if not exists nhap_kho_ma_may_idx on public.nhap_kho (ma_may);

comment on column public.nhap_kho.ma_may is 'NULL = dòng kho (ten_kho). Có giá trị = dòng máy, ten_kho để trống.';

select 'OK - nhap_kho.ma_may / ten_may.' as result;
