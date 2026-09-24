-- Mô tả tem đơn miền nam trên sổ nhap_kho.
-- Chuỗi đã ghép, vd: (Dán Tem 1.5li) Màu Hồng MVCC Dán Tem 2 Đầu
-- Chạy an toàn khi chạy lại.

alter table public.nhap_kho
  add column if not exists mo_ta_tem text;

comment on column public.nhap_kho.mo_ta_tem is 'Mô tả tem đã ghép từ đơn miền nam, vd (Dán Tem 1.5li) Màu Hồng MVCC Dán Tem 2 Đầu.';

select 'OK - nhap_kho đã có cột mo_ta_tem.' as result;
