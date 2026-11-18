-- Đã bỏ tên ghép trên danh mục sản phẩm.
-- Chỉ dùng ten_san_xuat (canonical). Cột ten_ghep legacy được gỡ nếu còn.
-- Chạy an toàn nhiều lần trong Supabase SQL Editor.

alter table public.san_pham
  drop column if exists ten_ghep;

select 'OK - Đã bỏ cột san_pham.ten_ghep (chỉ dùng ten_san_xuat).' as result;
