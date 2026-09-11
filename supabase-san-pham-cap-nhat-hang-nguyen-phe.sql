-- Cập nhật hàng phế "hàng nguyên phế" lấy từ tên sản xuất (ten_san_xuat).
-- Quy tắc: tên SX có cụm "nguyên phế" (vd "... - hàng nguyên phế") -> hang_phe = 'hàng nguyên phế'.
-- Chạy trong Supabase SQL Editor. Chạy B0 + B1 để kiểm tra trước, rồi mới chạy B2.
-- Có thể chạy lại nhiều lần (chỉ chạm các dòng đang lệch).

-- B0: xem các giá trị hang_phe hiện có
select coalesce(nullif(btrim(hang_phe), ''), '(trống)') as hang_phe, count(*) as so_dong
from public.san_pham
group by 1
order by 2 desc;

-- B1: xem trước các dòng tên SX ghi "nguyên phế" nhưng hang_phe chưa đúng
select id, ma_sp, ma_amis, ten_san_xuat, hang_phe
from public.san_pham
where coalesce(ten_san_xuat, '') ilike '%nguyên%phế%'
  and coalesce(btrim(hang_phe), '') is distinct from 'hàng nguyên phế'
order by ma_sp;

-- B2: cập nhật — chỉ các dòng tên SX có marker mà hang_phe đang lệch
update public.san_pham as s
set hang_phe = 'hàng nguyên phế'
where coalesce(s.ten_san_xuat, '') ilike '%nguyên%phế%'
  and coalesce(btrim(s.hang_phe), '') is distinct from 'hàng nguyên phế';

-- B3: kiểm tra lại — phải trả về 0 dòng
select id, ma_sp, ten_san_xuat, hang_phe
from public.san_pham
where coalesce(ten_san_xuat, '') ilike '%nguyên%phế%'
  and coalesce(btrim(hang_phe), '') is distinct from 'hàng nguyên phế';

select 'OK - các SP tên SX ghi nguyên phế đã có hang_phe = hàng nguyên phế.' as result;
