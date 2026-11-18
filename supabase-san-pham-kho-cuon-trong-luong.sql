-- Không dùng các cột khổ cuộn / trọng lượng trên danh mục san_pham.
-- Khổ cuộn & TL quy đổi nằm ở san_pham_quy_doi. Chạy an toàn nhiều lần.

alter table public.san_pham
  drop column if exists tong_trong_luong,
  drop column if exists kho_cuon,
  drop column if exists chieu_dai_cuon,
  drop column if exists trong_luong_loi,
  drop column if exists trong_luong_tui,
  drop column if exists trong_luong_nhua;

select 'OK - Đã bỏ tong_trong_luong / kho_cuon / chieu_dai_cuon / trong_luong_loi / tui / nhua trên san_pham.' as result;
