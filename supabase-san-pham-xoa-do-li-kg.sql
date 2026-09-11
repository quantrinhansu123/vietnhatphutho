-- Xóa (null) cột do_li trên san_pham khi giá trị chứa KG (không phải độ li).
-- Chạy trong Supabase SQL Editor.

-- Preview trước khi cập nhật:
-- select id, ma_amis, ten_san_xuat, do_li
-- from public.san_pham
-- where do_li ~* 'kg';

update public.san_pham
set do_li = null
where do_li is not null
  and do_li ~* 'kg';

select 'OK - Đã xóa do_li chứa KG: ' || count(*)::text as result
from public.san_pham
where do_li is null;
