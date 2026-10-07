-- Mã SP cũ để truy vết và tổng hợp biến thể cắt lẻ trong sổ nhập kho.
-- Chạy an toàn nhiều lần trong Supabase SQL Editor.
-- Quy ước (plan lệnh cắt lẻ kho):
--   ma_sp    : mã MỚI của biến thể (khớp san_pham.ma_amis của dòng biến thể)
--   ma_sp_cu : mã CHUẨN GỐC (khớp san_pham.ma_amis_cu) — dùng để tổng hợp về sau.

alter table public.nhap_kho
  add column if not exists ma_sp_cu text;

comment on column public.nhap_kho.ma_sp_cu is 'Mã SP chuẩn gốc của biến thể cắt lẻ (ma_sp của dòng này là mã mới). Dùng để tổng hợp tồn/nhập/xuất về mã gốc.';

create index if not exists nhap_kho_ma_sp_cu_idx on public.nhap_kho (ma_sp_cu);
