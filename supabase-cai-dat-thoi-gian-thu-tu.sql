-- Chuoi ca san xuat (so tron): loai ca + thu tu ca trong loai.
-- Chay toan bo file nay trong Supabase SQL Editor (Project > SQL > New query).
-- An toan khi chay lai nhieu lan (add column if not exists).
--
-- Cach dung (nhap ngoai man hinh /cai-dat, khong can sua SQL):
-- - Loai ca luu o cot `loai_ca` moi nay: 'Ca8H' (HC1 -> HC2 -> HC3) hoac 'Ca12H' (12C1 -> 12C2).
-- - Thu tu ca trong loai luu o cot `thu_tu` moi nay: HC1=1, HC2=2, HC3=3, 12C1=1, 12C2=2.
-- - Giu nguyen `loai_cai_dat = 'Thoi gian'` de dropdown ca toan app khong bi gay.
-- - Khong dung cot `nhom` chung de phan biet chuoi ca.
-- - Ca dem tinh theo NGAY BAT DAU (vd ca 12C2 20:00 ngay N -> 08:00 ngay N+1 thi phieu ghi ngay N).

alter table public.cai_dat_thoi_gian
  add column if not exists loai_ca text,
  add column if not exists thu_tu integer;

comment on column public.cai_dat_thoi_gian.loai_ca is 'Loai ca san xuat: Ca8H (HC1 -> HC2 -> HC3) hoac Ca12H (12C1 -> 12C2). Rong = khong thuoc chuoi nao.';
comment on column public.cai_dat_thoi_gian.thu_tu is 'Thu tu ca trong loai ca. VD: HC1=1, HC2=2, HC3=3, 12C1=1, 12C2=2. NULL = cuoi loai.';
