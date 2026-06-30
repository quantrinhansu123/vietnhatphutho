-- Chay sau supabase-san-pham-dinh-muc.sql
-- Cap nhat dinh muc san pham theo ma AMIS (khop ma_amis hoac ma_sp)

WITH specs AS (
  SELECT *
  FROM (
    VALUES
  ('MT- MN001', 'Màng nhựa 1.20m CK(40cm x3)- 6.5kg CLCM +-0.2kg', 'Cuộn', 6.5, 1.2, 90, 0.8, 0.17),
  ('MT- MN002', 'Màng nhựa 1.20m cắt khúc 4- 6.5kg CLCM +-0.2kg', 'Cuộn', 6.5, 1.2, 90, 0.8, 0.17),
  ('MT- MN003', 'Màng nhựa 1.20m cắt khúc 6- 6.5kg CLCM +-0.2kg', 'Cuộn', 6.5, 1.2, 90, 0.8, 0.17),
  ('MT- MN004', 'Màng nhựa 1.4m CK (50cm x 2 +40cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN005', 'Màng nhựa 1.4m CK (40cm x 3 +20cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN006', 'Màng nhựa 1.4m CK (70cm x 2)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN007', 'Màng nhựa 1.4m CK (20cm x 7)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN008', 'Màng nhựa 1.4m*100m-7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN009', 'Màng nhựa 1.50m CK (30cm x 5)- 7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, 90, 1, 0.17),
  ('MT- MN010', 'Màng nhựa 1.50m CK (50cm x 3)- 7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, 90, 1, 0.17),
  ('MT- MN011', 'Màng nhựa 1.4m CK (30cm x 4 +20cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN012', 'Màng nhựa 0.45m*100m-3kg +-0.2kg', 'Cuộn', 3, 0.45, 90, 0.3, 0.17),
  ('MT- MN013', 'Màng nhựa 1.2*100m-5kg- CLCM +-0.2kg', 'Cuộn', 5, 1.2, 90, 0.8, 0.17),
  ('MT- MN014', 'Màng nhựa 1.2m*100m-6.5kg CLCM +-0.2kg', 'Cuộn', 6.5, 1.2, 90, 1.3, 0.17),
  ('MT- MN015', 'Màng nhựa 1.4m*100m-7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.4, 90, 0.93, 0.17),
  ('MT- MN016', 'Màng nhựa 1.4m*100m-8kg - Cắt khúc +-0.2kg', 'Cuộn', 8, 1.4, 90, 0.93, 0.17),
  ('MT- MN017', 'Màng nhựa 1.50m CK (60cm x 2+30)- 7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, 90, 1, 0.17),
  ('MT- MN018', 'Màng nhựa 1.50m- 7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, 90, 1, 0.17),
  ('MT- MN019', 'Màng nhựa 1.4m CK (60cm x 2 +20cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN020', 'Màng nhựa 1.4m CK (60+ 80cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN021', 'Màng nhựa 1.4m CK (100cm+40cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN022', 'Màng nhựa 1.4m CK (45cmx2+50cm)- 7kg CLCM +-0.2kg', 'Cuộn', 7, 1.4, 90, 0.93, 0.17),
  ('MT- MN023', 'Màng nhựa 1.1*100m-.5.5kg- CLCM +-0.2kg', 'Cuộn', 5.5, 1, 90, 0.73, 0.17),
  ('MT- MN024', 'Màng nhựa 1.m*100m-.5.5kg- CLCM +-0.2kg', 'Cuộn', 5.5, 1, 90, 0.67, 0.17),
  ('MT- MN025', 'Màng nhựa 1.4m*100m-6.8kg CLCM +-0.2kg', 'Cuộn', 6.8, 1.4, 90, 0.93, 0.17),
  ('MT- MN026', 'Màng nhựa 1.50m- 7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.5, 90, 1, 0.17),
  ('MT- MN027', 'Màng nhựa 1.60m- 8kg CLCM +-0.2kg', 'Cuộn', 8, 1.6, 90, 1.07, 0.17),
  ('MT- MN028', 'Màng nhựa 1.5m - 7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.5, 90, 1, 0.17),
  ('MT- MN029', 'Màng nhựa 1.5m*95m*6.96kg không lõi CK (30cmx5', 'Cuộn', 6.96, 1.5, 95, 0, 0.17),
  ('MT- MN030', 'Màng nhựa 1.5m*95m*6.96kg không lõi CK (50cmx3)', 'Cuộn', 6.96, 1.5, 95, 0, 0.17),
  ('MT- MN031', 'Màng nhựa 1.5m*95m*6.96kg không lõi CK (60cmx2+30cm)', 'Cuộn', 6.96, 1.5, 95, 0, 0.17),
  ('MT- MN032', 'Màng nhựa 1.5m*95m*6.96kg không lõi CK (25cmx6)', 'Cuộn', 6.96, 1.5, 95, 0, 0.17),
  ('MT- MN033', 'Màng nhựa 1.4m*95m-6.5kg Không lõi +-0.2kg Ck(20cmx7)', 'Cuộn', 6.5, 1.4, 95, 0, 0.17),
  ('MT- MN034', 'Màng nhựa 1.4m*95m-6.5kg Không lõi +-0.2kg Ck(70cmx2', 'Cuộn', 6.5, 1.4, 95, 0, 0.17),
  ('MT- MN035', 'Màng Nhựa 30cmx45m x0,78kg có lõi', 'Cuộn', 0.78, NULL::numeric, NULL::numeric, 0.2, NULL::numeric),
  ('MT- MN036', 'Màng nhựa 1.6m*95m-7.4kg Không lõi +-0.2kg Ck(80cmx2)', 'Cuộn', 7.4, 1.6, 95, 0, 0.17),
  ('MT- MN039', 'Màng nhựa 1m*100m-5kg CLCM +-0.2kg', 'Cuộn', 5, 1, 90, 0.67, 0.17),
  ('MT- MN040', 'Màng nhựa 1.2m*100m-6kg CLCM +-0.2kg', 'Cuộn', 6, 1.2, 90, 0.8, 0.17),
  ('MT- MN041', 'Màng nhựa 1.4m CK (20cmx7)-7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.4, 90, 0.93, 0.17),
  ('MT- MN042', 'Màng nhựa 1.60m CK (40cmx4) 8kg CLCM +-0.2kg', 'Cuộn', 8, 1.6, 90, 1.07, 0.17),
  ('MT- MN043', 'Màng nhựa 1.5m CK (20cmx6+30)-7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.6, 90, 1, 0.17),
  ('MT- MN044', 'Màng nhựa 1.4m CK (40cmx3+20cm)-7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.4, 90, 0.93, 0.17),
  ('MT- MN045', 'Màng nhựa 1.4m CK (70cmx2)-7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.4, 90, 0.93, 0.17),
  ('MT- MN046', 'Màng nhựa 1.4m CK (80cm+60cm)-7.3kg CLCM +-0.2kg', 'Cuộn', 7.3, 1.4, 90, 0.93, 0.17),
  ('MT- MN047', 'Màng nhựa 1.5m CK (40cmx3+30)-7.8kg CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, 90, 1, 0.17),
  ('MT- MN048', 'Màng nhựa 1.2m*100m-5.5kg Không lõi +-0.2kg', 'Cuộn', 5.5, 1.2, 90, 0, 0.17),
  ('MT- MN049', 'Màng nhựa 1m*100m-4.6kg Không lõi +-0.2kg', 'Cuộn', 4.6, 1, 90, 0, 0.17),
  ('MT- MN050', 'Màng nhựa 1.4m*95m-6.5kg Không lõi. không túi +-0.2kg', 'Cuộn', 6.5, 1.4, 95, 0, NULL::numeric),
  ('MT- MN051', 'Màng nhựa 1.50mx100m CK (30cm x 5)- 6.7kg Không lõiCLCM +-0.2kg', 'Cuộn', 6.7, 1.5, 90, 0, 0.17),
  ('MT- MN052', 'Màng nhựa 1.50mx100m CK (50cm x 3)- 6.7kg Không lõiCLCM +-0.2kg', 'Cuộn', 6.7, 1.5, 90, 0, 0.17),
  ('MT- MN053', 'Màng nhựa 1.2mx80m-5.2kg CLCM +-0.2kg', 'Cuộn', 5.2, 1.2, 80, 0.8, 0.17),
  ('MT- MN054', 'Màng nhựa 1.4m*80m-6kg CLCM +-0.2kg', 'Cuộn', 6, 1.4, 80, 0.93, 0.17),
  ('MT- MN055', 'Màng nhựa 1.4m*80m-6kg CK (70cmx2) CLCM +-0.2kg', 'Cuộn', 6, 1.4, 80, 0.93, 0.17),
  ('MT- MN056', 'Màng nhựa 1.50mx80m- 7.kg CLCM +-0.2kg', 'Cuộn', 7, 1.5, 80, 1, 0.17),
  ('MT- MN057', 'Màng nhựa 1.50mx80m- 7.kg CK(50cmx3)CLCM +-0.2kg', 'Cuộn', 7, 1.5, 80, 1, 0.17),
  ('MT- MN058', 'Màng nhựa 1.4m*80m-6kg CK (20cmx7) CLCM +-0.2kg', 'Cuộn', 6, 1.4, 80, 0.93, 0.17),
  ('MT- MN059', 'Màng nhựa 1m*80m-4.55kg CLCM +-0.2kg', 'Cuộn', 4.55, 1, 80, 0.67, 0.17),
  ('MT- MN060', 'Màng nhựa 1.20m 6.3kg CLCM +-0.2kg', 'Cuộn', 6.3, 1.2, 90, 0.8, 0.17),
  ('MT- MN061', 'Màng nhựa 1.6m*95m-7.4kg Không lõi +-0.2kg', 'Cuộn', 7.4, 1.6, 95, 0, 0.17),
  ('MT- MN062', 'Màng nhựa 0,4m x 90m 2kg', 'Cuộn', 2, NULL::numeric, NULL::numeric, 0.1, 0.17),
  ('MT- MN063', 'Màng nhựa 1.50m- 7.8kg CK( 120cm+30cm) CLCM +-0.2kg', 'Cuộn', 7.8, 1.5, NULL::numeric, 1, 0.17),
  ('MT- TCN0001', 'Tấm cách nhiệt Coolhouse P02- 1.55 (16kg) +-0.2kg', 'Cuộn', 16, 1.54, 40, 1, 0.2),
  ('MT- TCN0002', 'Tấm cách nhiệt Green P02- 1.55 (14kg)+-0.2kg', 'Cuộn', 14, 1.54, 40, 1, 0.2),
  ('MT- TCN0003', 'Tấm cách nhiệt Green P02- 1.05m (9.5kg) +-0.2kg', 'Cuộn', 9.5, 1.05, 40, 0.68, 0.16),
  ('MT- TCN0004', 'Tấm cách nhiệt HASIMO P02- 1.55 (13.5kg) +-0.2kg', 'Cuộn', 13.5, 1.54, 40, 1, 0.2),
  ('MT- TCN0005', 'Tấm cách nhiệt HASIMO P02- 1.05 (9.2kg) +-0.2kg', 'Cuộn', 9.2, 1.05, 40, 0.68, 0.16),
  ('MT- TCN0006', 'Tấm cách nhệt PROHOUSE P01- 1.55 (13kg) +-0.2kg', 'Cuộn', 13, 1.54, 40, 1, 0.2),
  ('MT- TCN0007', 'Tấm cách nhiệt PROHOUSE P02- 1.55 (15kg) +-0.2kg', 'Cuộn', 15, 1.54, 40, 1, 0.2),
  ('MT- TCN0008', 'Tấm cách nhiệt Prohouse P02- 1.05 (10.2kg) +-0.2kg', 'Cuộn', 10.2, 1.54, 40, 0.68, 0.2),
  ('MT- TCN0009', 'Tấm cách nhiệt Prohouse P02 - 18mx1,05m +-0.2kg', 'Cuộn', NULL::numeric, 1.05, 18, NULL::numeric, NULL::numeric),
  ('MT- TCN0010', 'Tấm cách nhiệt Ranko P02- 1.55 (13kg) +-0.2kg', 'Cuộn', 13, 1.54, 40, 1, 0.2),
  ('MT- TCN0011', 'Tấm cách nhiệt Ranko P02- 1.05 (9.5kg) +-0.2kg', 'Cuộn', 9.5, 1.05, 40, 0.68, 0.16),
  ('MT- TCN0012', 'Tấm cách nhiệt HASIMO P02-LPP (12.7kg) +-0.2kg', 'Cuộn', 12.7, 1.54, 40, 1, 0.2),
  ('MT- TCN0013', 'Tấm cách nhiệt Ranko P02- 1.55 (13kg) +-0.2kg(mới)', 'Cuộn', 13, 1.54, 40, 1, 0.2),
  ('MT- TCN0014', 'Tấm cách nhiệt PROHOUSE P02- 1.55 (15kg) +-0.2kg(mới)', 'Cuộn', 15, 1.54, 40, 1, 0.2),
  ('MT- TCN0015', 'Tấm cách nhiệt HASIMO P02-LPP (12.7kg) +-0.2kg(mới)', 'Cuộn', 12.7, 1.54, 40, 1, 0.2),
  ('MT- TCN0016', 'Tấm cách nhiệt Ranko P02- 1.55 (13kg) N2+-0.2kg(mới)', 'Cuộn', 13, 1.54, 40, 1, 0.2),
  ('MT- TCN0017', 'Tấm cách nhiệt Ranko P02- 1.55 (13kg) N1 +-0.2kg(mới)', 'Cuộn', 13, 1.54, 40, 1, 0.2)
  ) AS t(
    ma_amis,
    ten_sp,
    don_vi,
    tong_trong_luong,
    kho_cuon,
    chieu_dai_cuon,
    trong_luong_loi,
    trong_luong_tui
  )
),
normalized AS (
  SELECT
    s.*,
  CASE
    WHEN s.tong_trong_luong IS NOT NULL
      THEN round(
        s.tong_trong_luong
        - coalesce(s.trong_luong_loi, 0)
        - coalesce(s.trong_luong_tui, 0),
        2
      )
    ELSE NULL
  END AS trong_luong_nhua
  FROM specs s
),
updated AS (
  UPDATE public.san_pham sp
  SET
    ma_amis = n.ma_amis,
    ten_sp = n.ten_sp,
    don_vi = n.don_vi,
    tong_trong_luong = n.tong_trong_luong,
    kho_cuon = n.kho_cuon,
    chieu_dai_cuon = n.chieu_dai_cuon,
    trong_luong_loi = n.trong_luong_loi,
    trong_luong_tui = n.trong_luong_tui,
    trong_luong_nhua = n.trong_luong_nhua
  FROM normalized n
  WHERE regexp_replace(trim(coalesce(sp.ma_amis, '')), '\s+', '', 'g')
      = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
     OR regexp_replace(trim(coalesce(sp.ma_sp, '')), '\s+', '', 'g')
      = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
  RETURNING sp.id
)
INSERT INTO public.san_pham (
  ma_sp,
  ma_amis,
  ten_sp,
  don_vi,
  tong_trong_luong,
  kho_cuon,
  chieu_dai_cuon,
  trong_luong_loi,
  trong_luong_tui,
  trong_luong_nhua
)
SELECT
  n.ma_amis,
  n.ma_amis,
  n.ten_sp,
  n.don_vi,
  n.tong_trong_luong,
  n.kho_cuon,
  n.chieu_dai_cuon,
  n.trong_luong_loi,
  n.trong_luong_tui,
  n.trong_luong_nhua
FROM normalized n
WHERE NOT EXISTS (
  SELECT 1
  FROM public.san_pham sp
  WHERE regexp_replace(trim(coalesce(sp.ma_amis, '')), '\s+', '', 'g')
      = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
     OR regexp_replace(trim(coalesce(sp.ma_sp, '')), '\s+', '', 'g')
      = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
);

-- Kiem tra ma chua khop (nen tra ve 0 dong neu da day du):
-- SELECT n.ma_amis
-- FROM normalized n
-- LEFT JOIN public.san_pham sp
--   ON regexp_replace(trim(coalesce(sp.ma_amis, '')), '\s+', '', 'g')
--    = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
--   OR regexp_replace(trim(coalesce(sp.ma_sp, '')), '\s+', '', 'g')
--    = regexp_replace(trim(n.ma_amis), '\s+', '', 'g')
-- WHERE sp.id IS NULL;
