-- Thêm cột ca_lam_viec và may vào bảng phan_cong_nhan_su_chi_tiet
-- Columns: ca_lam_viec (shift), may (machine name)

alter table public.phan_cong_nhan_su_chi_tiet
add column if not exists ca_lam_viec text;

alter table public.phan_cong_nhan_su_chi_tiet
add column if not exists may text;

comment on column public.phan_cong_nhan_su_chi_tiet.ca_lam_viec is 'Ca lam viec (1, 2, 3, etc.) cua nhan su.';
comment on column public.phan_cong_nhan_su_chi_tiet.may is 'May duoc phan cong / ten may.';
