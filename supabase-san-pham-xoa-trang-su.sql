-- Xóa sản phẩm nhựa Đặc màu trắng sứ (STD01) đã ngừng kinh doanh.
-- Chạy 1 lần trong Supabase SQL Editor. Kiểm tra SELECT trước, rồi mới chạy DELETE.
-- API thêm/sửa/import đã chặn tạo mới các SP này nên sau khi xóa sẽ không quay lại.

-- 1) Xem trước các dòng sẽ xóa:
-- select id, ma_sp, ma_amis, ten_sp, ten_san_xuat, nhom_vthh
-- from public.san_pham
-- where nhom_vthh = 'TP; PX Đặc'
--   and (
--     ma_amis ilike 'STD01%'
--     or ten_sp ilike '%trắng sứ%'
--     or ten_san_xuat ilike '%trắng sứ%'
--   );

begin;

delete from public.san_pham
where nhom_vthh = 'TP; PX Đặc'
  and (
    ma_amis ilike 'STD01%'
    or ten_sp ilike '%trắng sứ%'
    or ten_san_xuat ilike '%trắng sứ%'
  );

commit;

notify pgrst, 'reload schema';
