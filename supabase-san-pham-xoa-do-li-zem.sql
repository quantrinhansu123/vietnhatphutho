-- Xóa giá trị độ li chứa ZEM trên bảng san_pham.
-- Quy tắc (đồng bộ app): ZEM trong tên SX/mã AMIS KHÔNG phải độ li —
-- do_li chỉ nhận token …li. Các do_li …li (vd 0.8li) được giữ nguyên.
-- Chạy trong Supabase SQL Editor. Chạy B0 + B1 để kiểm tra trước, rồi mới chạy B2.
-- Có thể chạy lại nhiều lần (chỉ chạm các dòng đang lệch).

-- B0: thống kê các giá trị do_li chứa ZEM hiện có
select do_li, count(*) as so_dong
from public.san_pham
where coalesce(do_li, '') ilike '%zem%'
group by do_li
order by 2 desc;

-- B1: xem trước các dòng sẽ bị xóa do_li (kèm tên SX để đối chiếu)
select id, ma_sp, ma_amis, ten_san_xuat, do_li
from public.san_pham
where coalesce(do_li, '') ilike '%zem%'
order by ma_sp;

-- B2: xóa — chỉ các dòng do_li chứa ZEM, các do_li …li giữ nguyên
update public.san_pham as s
set do_li = null
where coalesce(s.do_li, '') ilike '%zem%';

-- B3: kiểm tra lại — phải trả về 0 dòng
select id, ma_sp, ten_san_xuat, do_li
from public.san_pham
where coalesce(do_li, '') ilike '%zem%';

-- Trường hợp muốn xóa TRIỆT ĐỂ mọi do_li trên SP có ZEM trong tên
-- (kể cả do_li …li, vd 0.8li trên tên có 8ZEM) thì dùng câu dưới đây
-- thay cho B2. Mặc định KHÔNG khuyến nghị (mất dữ liệu li tường minh).
-- update public.san_pham as s
-- set do_li = null
-- where coalesce(s.ten_san_xuat, '') ilike '%zem%'
--   and s.do_li is distinct from null;

select 'OK - do_li không còn giá trị chứa ZEM.' as result;
