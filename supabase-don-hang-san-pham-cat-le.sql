-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Không đổi schema — cột public.don_hang.san_pham đã là jsonb tự do khoá từ trước
-- (xem supabase-don-hang-san-pham.sql). File này chỉ cập nhật comment để tài liệu hoá
-- các khoá mới dùng riêng cho loại đơn "Đơn theo quy cách của khách đặt" (đơn cắt lẻ).

comment on column public.don_hang.san_pham is
  'Danh sách sản phẩm trong đơn: ma_sp, don_vi, ten_sp, san_pham_id, ten_san_xuat, so_luong. '
  'Đơn "Đơn theo quy cách của khách đặt" (cắt lẻ) có thêm: do_li (text, vd "8"), '
  'kho (numeric, m), dai_m (numeric, m), ghi_chu (text, ghi chú theo dòng).';
