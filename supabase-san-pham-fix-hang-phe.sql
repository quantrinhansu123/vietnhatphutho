-- Sửa hàng phế (hang_phe) bị gán nhầm trên bảng san_pham.
-- Quy tắc (đồng bộ với app src/utils/productProductionName.ts):
--   CHỈ khi ten_san_xuat ghi rõ cụm hàng phế thì hang_phe mới có giá trị:
--     + tên có "NS Off"            -> 'hàng 100% NS Off'
--     + tên có "nguyên phế"        -> 'hàng nguyên phế'
--     + tên có "100% phế"          -> 'hàng chạy 100% phế'
--     + còn lại (kể cả mã AMIS chứa NP) -> NULL
-- Chạy trong Supabase SQL Editor. Chạy B0 + B1 để kiểm tra trước, rồi mới chạy B2.
-- Có thể chạy lại nhiều lần (chỉ chạm các dòng đang lệch).
-- Lưu ý: dòng nào chọn tay hang_phe nhưng tên SX không ghi marker cũng sẽ bị
-- đưa về NULL theo đúng quy tắc. Nếu grade là thật, hãy bổ sung marker vào
-- ten_san_xuat trước khi chạy B2.

-- B0: xem các giá trị hang_phe hiện có
select coalesce(nullif(btrim(hang_phe), ''), '(trống)') as hang_phe, count(*) as so_dong
from public.san_pham
group by 1
order by 2 desc;

-- B1: xem trước các dòng đang SAI (có hang_phe nhưng tên SX không ghi marker)
select id, ma_sp, ma_amis, ten_san_xuat, hang_phe
from public.san_pham
where coalesce(btrim(hang_phe), '') <> ''
  and coalesce(ten_san_xuat, '') not ilike '%100%phế%'
  and coalesce(ten_san_xuat, '') not ilike '%NS%Off%'
  and coalesce(ten_san_xuat, '') not ilike '%nguyên%phế%'
order by ma_sp;

-- B1b: xem trước các dòng đang THIẾU (tên SX có ghi marker nhưng hang_phe trống/sai)
select id, ma_sp, ma_amis, ten_san_xuat, hang_phe,
  case
    when ten_san_xuat ilike '%NS%Off%' then 'hàng 100% NS Off'
    when ten_san_xuat ilike '%nguyên%phế%' then 'hàng nguyên phế'
    when ten_san_xuat ilike '%100%phế%' then 'hàng chạy 100% phế'
  end as hang_phe_dung
from public.san_pham
where coalesce(ten_san_xuat, '') ilike '%100%phế%'
   or coalesce(ten_san_xuat, '') ilike '%NS%Off%'
   or coalesce(ten_san_xuat, '') ilike '%nguyên%phế%'
order by ma_sp;

-- B2: sửa — tính lại hang_phe theo tên SX, chỉ update các dòng đang lệch
with expected as (
  select
    id,
    case
      when coalesce(ten_san_xuat, '') ilike '%NS%Off%' then 'hàng 100% NS Off'
      when coalesce(ten_san_xuat, '') ilike '%nguyên%phế%' then 'hàng nguyên phế'
      when coalesce(ten_san_xuat, '') ilike '%100%phế%' then 'hàng chạy 100% phế'
      else null
    end as hang_phe_new
  from public.san_pham
)
update public.san_pham as s
set hang_phe = e.hang_phe_new
from expected as e
where s.id = e.id
  and s.hang_phe is distinct from e.hang_phe_new;

-- B3: kiểm tra lại — phải trả về 0 dòng
select id, ma_sp, ten_san_xuat, hang_phe
from public.san_pham
where coalesce(btrim(hang_phe), '') <> ''
  and coalesce(ten_san_xuat, '') not ilike '%100%phế%'
  and coalesce(ten_san_xuat, '') not ilike '%NS%Off%'
  and coalesce(ten_san_xuat, '') not ilike '%nguyên%phế%';

select 'OK - hang_phe chỉ còn ở các SP có tên SX ghi rõ marker.' as result;
