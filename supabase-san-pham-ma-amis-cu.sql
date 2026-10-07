-- Mã AMIS cũ để truy vết biến thể cắt lẻ / đơn miền nam.
-- Chạy an toàn nhiều lần trong Supabase SQL Editor.
-- Quy ước (plan lệnh cắt lẻ kho):
--   ma_amis    : mã MỚI của biến thể sau hạ khổ / hạ li / hạ m dài / dán tem
--                (vd STD06-0.8li*1.22m-3m (đm 0.75 li) màng ECO - T1.2-MVKH-2DAU)
--   ma_amis_cu : mã CHUẨN GỐC để truy vết và tổng hợp về sau (vd STD06-0.8li*1.22m)
-- Mỗi biến thể khác nhau là một dòng san_pham riêng (unique ma_amis+ten_sp+ten_san_xuat).

alter table public.san_pham
  add column if not exists ma_amis_cu text;

comment on column public.san_pham.ma_amis_cu is 'Mã AMIS chuẩn gốc để truy vết biến thể cắt lẻ / đơn miền nam (ma_amis của dòng này là mã mới).';

create index if not exists san_pham_ma_amis_cu_idx on public.san_pham (ma_amis_cu);
