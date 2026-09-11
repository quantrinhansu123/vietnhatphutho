-- Cột ten_ghep trên danh mục sản phẩm: tên ghép hiển thị, tính từ tên SX
-- (thứ tự: tên gốc - hàng phế - màng - độ li - đm - độ dày - mét dài).
-- App tự tính + lưu mỗi khi thêm/sửa/import SP. Không đổi unique hiện có.

alter table public.san_pham
  add column if not exists ten_ghep text;

comment on column public.san_pham.ten_ghep is 'Ten ghep hien thi (ten goc - hang phe - mang - do li - dm - do day - met dai). App tu tinh khi luu SP.';

-- Backfill cho dữ liệu cũ: ghép từ 7 cột thông số SX (bỏ đoạn trống),
-- chỉ chạm các dòng đang lệch. Có thể chạy lại nhiều lần.
update public.san_pham as s
set ten_ghep = v.ten_ghep_new
from (
  select
    id,
    nullif(
      concat_ws(
        ' - ',
        nullif(btrim(ten_goc), ''),
        nullif(btrim(hang_phe), ''),
        nullif(btrim(mang), ''),
        nullif(btrim(do_li), ''),
        nullif(btrim(do_li_dm), ''),
        nullif(btrim(do_day_m), ''),
        nullif(btrim(do_dai_m), '')
      ),
      ''
    ) as ten_ghep_new
  from public.san_pham
) as v
where s.id = v.id
  and s.ten_ghep is distinct from v.ten_ghep_new;

select 'OK - Đã thêm cột ten_ghep và backfill từ thông số SX.' as result;
