-- Chay TOAN BO file nay trong Supabase SQL Editor (1 lan)
-- Sua loi: invalid input syntax for type integer: "0.01"
-- Bang cu co the tao cot so_luong kieu integer thay vi numeric.

alter table public.phieu_xuat_nhap_kho
  alter column so_luong type numeric using so_luong::numeric;

-- Dam bao don gia / thanh tien cung la numeric (an toan neu bang cu khac kieu)
alter table public.phieu_xuat_nhap_kho
  alter column don_gia type numeric using don_gia::numeric;

alter table public.phieu_xuat_nhap_kho
  alter column thanh_tien type numeric using thanh_tien::numeric;

notify pgrst, 'reload schema';
