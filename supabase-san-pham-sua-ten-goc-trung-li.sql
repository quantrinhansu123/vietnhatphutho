-- Sửa tên gốc (ten_goc) bị trùng đuôi độ li với cột do_li
-- (vd ten_goc "NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI" + do_li "1.2li"
--  → ten_goc "NHỰA SÓNG TRẮNG - NP - 11 SÓNG",
--     ten_ghep "NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m").
-- Quy tắc: chỉ cắt khi đuôi ten_goc là số + li, số bằng số trong do_li,
-- và đuôi không nằm trong ngoặc. ten_ghep chỉ ghép lại khi đang chứa đoạn trùng.
-- Chạy trong Supabase SQL Editor. Chạy B0 + B1 để kiểm tra trước, rồi mới chạy B2.
-- Có thể chạy lại nhiều lần.

-- B0: thống kê các giá trị do_li của dòng bị ảnh hưởng
select do_li, count(*) as so_dong
from public.san_pham
where coalesce(do_li, '') ~* '^\d+[.,]?\d*\s*li$'
  and btrim(ten_goc) ~* '[\d.,]+\s*li\s*$'
group by do_li
order by 2 desc;

-- B1: xem trước các dòng sẽ sửa
with cand as (
  select
    id, ma_sp, ma_amis, ten_san_xuat, ten_goc, do_li, ten_ghep,
    btrim(
      regexp_replace(
        btrim(regexp_replace(btrim(ten_goc), '\s*[\d.,]+\s*li\s*$', '', 'i')),
        '\s*[-–—]\s*$', ''
      )
    ) as ten_goc_new,
    (regexp_match(btrim(ten_goc), '([\d.,]+\s*li)\s*$', 'i'))[1] as dup_seg
  from public.san_pham
  where coalesce(do_li, '') ~* '^\d+[.,]?\d*\s*li$'
    and btrim(ten_goc) ~* '[\d.,]+\s*li\s*$'
    and (length(ten_goc) - length(replace(ten_goc, '(', '')))
      = (length(ten_goc) - length(replace(ten_goc, ')', '')))
    and replace((regexp_match(btrim(ten_goc), '(\d+(?:[.,]\d+)?)\s*li\s*$', 'i'))[1], ',', '.')::numeric
      = replace(regexp_replace(do_li, '\s*li\s*$', '', 'i'), ',', '.')::numeric
)
select id, ma_sp, ten_goc, do_li, ten_goc_new, dup_seg, ten_ghep
from cand
where ten_goc_new <> '' and ten_goc_new is distinct from btrim(ten_goc)
order by ma_sp;

-- B2: sửa ten_goc + ghép lại ten_ghep (chỉ khi ten_ghep đang chứa đoạn trùng)
with cand as (
  select
    id,
    btrim(
      regexp_replace(
        btrim(regexp_replace(btrim(ten_goc), '\s*[\d.,]+\s*li\s*$', '', 'i')),
        '\s*[-–—]\s*$', ''
      )
    ) as ten_goc_new,
    (regexp_match(btrim(ten_goc), '([\d.,]+\s*li)\s*$', 'i'))[1] as dup_seg
  from public.san_pham
  where coalesce(do_li, '') ~* '^\d+[.,]?\d*\s*li$'
    and btrim(ten_goc) ~* '[\d.,]+\s*li\s*$'
    and (length(ten_goc) - length(replace(ten_goc, '(', '')))
      = (length(ten_goc) - length(replace(ten_goc, ')', '')))
    and replace((regexp_match(btrim(ten_goc), '(\d+(?:[.,]\d+)?)\s*li\s*$', 'i'))[1], ',', '.')::numeric
      = replace(regexp_replace(do_li, '\s*li\s*$', '', 'i'), ',', '.')::numeric
)
update public.san_pham as s
set ten_goc = c.ten_goc_new,
    ten_ghep = case
      when s.ten_ghep ilike '%' || c.dup_seg || '%'
        or s.ten_ghep ilike '%' || btrim(s.do_li) || '%'
      then nullif(
        concat_ws(
          ' - ',
          nullif(c.ten_goc_new, ''),
          nullif(btrim(s.hang_phe), ''),
          nullif(btrim(s.mang), ''),
          nullif(btrim(s.do_li), ''),
          nullif(btrim(s.do_li_dm), ''),
          nullif(btrim(s.do_day_m), ''),
          nullif(btrim(s.do_dai_m), '')
        ),
        ''
      )
      else s.ten_ghep
    end
from cand as c
where s.id = c.id
  and c.ten_goc_new <> ''
  and c.ten_goc_new is distinct from btrim(s.ten_goc);

-- B3: kiểm tra lại — phải trả về 0 dòng
select id, ma_sp, ten_goc, do_li
from public.san_pham
where coalesce(do_li, '') ~* '^\d+[.,]?\d*\s*li$'
  and btrim(ten_goc) ~* '[\d.,]+\s*li\s*$'
  and (length(ten_goc) - length(replace(ten_goc, '(', '')))
    = (length(ten_goc) - length(replace(ten_goc, ')', '')))
  and replace((regexp_match(btrim(ten_goc), '(\d+(?:[.,]\d+)?)\s*li\s*$', 'i'))[1], ',', '.')::numeric
    = replace(regexp_replace(do_li, '\s*li\s*$', '', 'i'), ',', '.')::numeric
  and btrim(
    regexp_replace(
      btrim(regexp_replace(btrim(ten_goc), '\s*[\d.,]+\s*li\s*$', '', 'i')),
      '\s*[-–—]\s*$', ''
    )
  ) is distinct from btrim(ten_goc);

select 'OK - ten_goc không còn đuôi li trùng do_li.' as result;
