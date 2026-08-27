-- Đảm bảo cột ma_may tồn tại trên bảng phan_cong_nhan_su_chi_tiet.
-- Server (savePhanCongNhanSuDetails, /api/lich-lam-viec, /api/phan-cong-nhan-su/nhom)
-- ghi/đọc theo ma_may nhưng trước đây chưa có file migration cho cột này.

alter table public.phan_cong_nhan_su_chi_tiet
add column if not exists ma_may text;

comment on column public.phan_cong_nhan_su_chi_tiet.ma_may is 'Ma may (machine code) cua nhan su trong lich lam viec - dung de gom cot khi in lich.';
