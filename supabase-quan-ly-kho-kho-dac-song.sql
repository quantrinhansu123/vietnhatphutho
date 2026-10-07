-- Kho chính cho lệnh cắt lẻ: Đặc → Kho Đặc; Sóng/Rỗng → Kho Sóng (rỗng chung kho sóng).
-- Chạy an toàn nhiều lần trong Supabase SQL Editor (chỉ thêm khi chưa có).
-- ma_kho tự slug theo quy ước supabase-quan-ly-kho-ma-kho.sql (kho_dac, kho_song).

insert into public.quan_ly_kho (ten_kho, ma_kho)
select v.ten_kho, v.ma_kho
from (
  values
    ('Kho Đặc', 'kho_dac'),
    ('Kho Sóng', 'kho_song')
) as v(ten_kho, ma_kho)
where not exists (
  select 1 from public.quan_ly_kho k
  where k.ten_kho = v.ten_kho or k.ma_kho = v.ma_kho
);
