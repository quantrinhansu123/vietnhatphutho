-- Thêm thông số sản phẩm miền nam:
--   TCMB  → chữ "TCMB" ghép ngay sau màng trong ten_san_xuat
--   ZEM   → tách khỏi tên gốc, ghép sau sóng (Sóng) / sau màu (Đặc)
--   so_song → số sóng (vd 11 của "11 SÓNG")
--   dinh_muc_kg → tách nhánh "(đm n kg)" khỏi do_li_dm (do_li_dm chỉ còn "(đm n li)")
--
-- do_li_dm KHÔNG đổi kiểu: vẫn text, nhưng từ nay chỉ lưu nhánh li.
-- Không đổi unique index nào.

alter table public.san_pham
  add column if not exists zem text,
  add column if not exists so_song text,
  add column if not exists tcmb boolean not null default false,
  add column if not exists dinh_muc_kg text;

comment on column public.san_pham.zem is 'ZEM (vd 6ZEM, 8ZEM): noi sau so song (Song) / sau mau (Dac).';
comment on column public.san_pham.so_song is 'So song (vd 11 cua "11 SONG"), luu dang chuoi so.';
comment on column public.san_pham.tcmb is 'Tieu chuan mien bac: true = chen chu TCMB sau mang trong ten_san_xuat.';
comment on column public.san_pham.dinh_muc_kg is 'Dinh muc kg dang chuoi canonical, vd "(đm 4.8 kg)". Tach khoi do_li_dm.';
comment on column public.san_pham.do_li_dm is 'Dinh muc li dang chuoi canonical, vd "(đm 1.8 li)". Chi nhanh li.';

-- Backfill: tách (đm n kg) khỏi do_li_dm sang dinh_muc_kg.
update public.san_pham
set
  dinh_muc_kg = substring(do_li_dm from '(?i)\(\s*đm\s*[\d.,]+\s*kg\s*\)'),
  do_li_dm = null
where do_li_dm ~* '\(\s*đm\s*[\d.,]+\s*kg\s*\)';

-- Backfill: ZEM trong tên gốc hoặc tên sản xuất.
update public.san_pham
set zem = upper(substring(coalesce(ten_san_xuat, '') || ' ' || coalesce(ten_goc, '') from '(?i)(\d+)\s*zem'))
where zem is null
  and coalesce(ten_san_xuat, '') || ' ' || coalesce(ten_goc, '') ~* '\d+\s*zem';

update public.san_pham
set zem = zem || 'ZEM'
where zem is not null and zem !~* 'zem$';

-- Backfill: TCMB trong tên sản xuất.
update public.san_pham
set tcmb = true
where tcmb is distinct from true
  and coalesce(ten_san_xuat, '') ~* '\bTCMB\b';

-- Backfill: số sóng.
update public.san_pham
set so_song = substring(ten_san_xuat from '(?i)(\d+)\s*sóng')
where so_song is null
  and coalesce(ten_san_xuat, '') ~* '\d+\s*sóng';

select 'OK - Đã thêm cột zem, so_song, tcmb, dinh_muc_kg và backfill từ ten_san_xuat.' as result;
