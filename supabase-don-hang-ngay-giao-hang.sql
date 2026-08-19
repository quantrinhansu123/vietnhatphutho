-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại).
alter table public.don_hang
  add column if not exists ngay_giao_hang date;

comment on column public.don_hang.ngay_giao_hang is
  'Ngày dự kiến giao đơn hàng.';

comment on column public.don_hang.san_pham is
  'Danh sách sản phẩm: ma_sp (mã AMIS), ten_sp, ten_san_xuat, don_vi, so_luong, ket_qua_quy_doi.';
