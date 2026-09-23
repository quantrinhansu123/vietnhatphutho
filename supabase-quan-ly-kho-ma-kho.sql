-- quan_ly_kho.ma_kho: mã kho ngầm tự động từ tên tiếng Việt
-- (không dấu, cách nhau bằng `_`): "Kho cắt lẻ" → "kho_cat_le".
-- Nguồn thật cho nhap_kho.loai_kho — không map cứng theo tên nữa.
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

alter table public.quan_ly_kho
  add column if not exists ma_kho text;

comment on column public.quan_ly_kho.ma_kho is 'Mã kho ngầm: slug tên Việt không dấu nối _ (kho_cat_le). Nguồn cho nhap_kho.loai_kho.';

