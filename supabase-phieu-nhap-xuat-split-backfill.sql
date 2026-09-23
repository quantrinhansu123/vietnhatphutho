-- Tach bang phieu_xuat_nhap_kho -> phieu_nhap_kho + phieu_xuat_kho
-- File 3/3: BACKFILL + DOI CHIEU. Chay SAU 2 file tao bang. Idempotent (chay lai an toan).
--
-- Thu tu chay:
--   1) supabase-phieu-nhap-kho.sql
--   2) supabase-phieu-xuat-kho.sql
--   3) file nay (backfill + doi chieu)
--
-- Giu NGUYEN id de id_dong_nhap_nguon (xuat -> nhap) khong dut.
-- Tu thich nghi: chi copy cac cot THUC SU CO trong bang cu
-- (VD DB chua chay migration co the thieu nguoi_giao, dia_diem...).
-- Cot loai_phieu set cung 'nhap'/'xuat'; cot thieu o nguon thi lay default bang moi.

do $$
declare
  common_cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into common_cols
  from information_schema.columns c
  join information_schema.columns t
    on t.table_schema = 'public'
   and t.table_name = 'phieu_nhap_kho'
   and t.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'phieu_xuat_nhap_kho'
    and c.column_name <> 'loai_phieu';

  if common_cols is null then
    raise exception 'Khong tim thay cot chung giua phieu_xuat_nhap_kho va phieu_nhap_kho';
  end if;

  -- 1) Copy dong nhap (giu id).
  execute format(
    'insert into public.phieu_nhap_kho (%s, loai_phieu)
     select %s, ''nhap''
     from public.phieu_xuat_nhap_kho
     where lower(trim(coalesce(loai_phieu, ''nhap''))) = ''nhap''
     on conflict (id) do nothing',
    common_cols, common_cols);

  -- 2) Copy dong xuat (giu id).
  execute format(
    'insert into public.phieu_xuat_kho (%s, loai_phieu)
     select %s, ''xuat''
     from public.phieu_xuat_nhap_kho
     where lower(trim(coalesce(loai_phieu, ''''))) = ''xuat''
     on conflict (id) do nothing',
    common_cols, common_cols);

  raise notice 'Backfill xong. Cot da copy: %', common_cols;
end
$$;

-- 3) DOI CHIEU (ket qua mong doi: deu 0 chenh lech).
-- 3a) So dong theo loai.
select
  (select count(*) from public.phieu_xuat_nhap_kho where lower(trim(coalesce(loai_phieu, 'nhap'))) = 'nhap') as cu_nhap,
  (select count(*) from public.phieu_nhap_kho) as moi_nhap,
  (select count(*) from public.phieu_xuat_nhap_kho where lower(trim(coalesce(loai_phieu, ''))) = 'xuat') as cu_xuat,
  (select count(*) from public.phieu_xuat_kho) as moi_xuat;
-- 3b) Tong so_luong theo loai (phat hien lech so).
select
  (select coalesce(sum(so_luong), 0) from public.phieu_xuat_nhap_kho where lower(trim(coalesce(loai_phieu, 'nhap'))) = 'nhap') as sl_cu_nhap,
  (select coalesce(sum(so_luong), 0) from public.phieu_nhap_kho) as sl_moi_nhap,
  (select coalesce(sum(so_luong), 0) from public.phieu_xuat_nhap_kho where lower(trim(coalesce(loai_phieu, ''))) = 'xuat') as sl_cu_xuat,
  (select coalesce(sum(so_luong), 0) from public.phieu_xuat_kho) as sl_moi_xuat;
-- 3c) Lien ket lo nhap con tro dung (xuat -> nhap) sau tach.
select count(*) as lien_ket_gay
from public.phieu_xuat_kho x
where x.id_dong_nhap_nguon is not null
  and not exists (select 1 from public.phieu_nhap_kho n where n.id = x.id_dong_nhap_nguon);
-- 3d) Ma phieu trung xuyen 2 bang (mong doi = 0; prefix PN-/PX- von da phan biet).
select count(*) as ma_phieu_trung_xuyen_bang
from (select distinct ma_phieu from public.phieu_nhap_kho where ma_phieu is not null) n
join (select distinct ma_phieu from public.phieu_xuat_kho where ma_phieu is not null) x
  on x.ma_phieu = n.ma_phieu;
