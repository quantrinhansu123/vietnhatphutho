-- Sổ trộn: 5 cột tổng hợp lưu cùng phiếu (chạy 1 lần trong Supabase SQL Editor).
-- tong_nvl: tổng NVL sử dụng (kg, từ bảng 1).
-- tong_sp_co_mang / tong_sp_khong_mang: tổng trọng lượng SP (kg) theo màng từng dòng.
-- tong_loi_hong: tổng hàng lỗi hỏng (kg, từ bảng 3).
-- chi_tieu_phan_tram: (tong_sp_co_mang + tong_sp_khong_mang) / 3100 * 100.
-- Màng từng dòng SP nằm trong bang_san_pham (jsonb, field `mang`) nên không cần cột riêng.

alter table public.so_tron
  add column if not exists tong_nvl numeric not null default 0,
  add column if not exists tong_sp_co_mang numeric not null default 0,
  add column if not exists tong_sp_khong_mang numeric not null default 0,
  add column if not exists tong_loi_hong numeric not null default 0,
  add column if not exists chi_tieu_phan_tram numeric not null default 0;

comment on column public.so_tron.tong_nvl is 'Tổng NVL sử dụng (kg). Frontend tự tính khi lưu.';
comment on column public.so_tron.tong_sp_co_mang is 'Tổng trọng lượng SP có màng (kg). Màng từng dòng lưu trong bang_san_pham[].mang.';
comment on column public.so_tron.tong_sp_khong_mang is 'Tổng trọng lượng SP không màng (kg).';
comment on column public.so_tron.tong_loi_hong is 'Tổng hàng lỗi hỏng (kg).';
comment on column public.so_tron.chi_tieu_phan_tram is 'Chỉ tiêu (%): (tong_sp_co_mang + tong_sp_khong_mang) / 3100 * 100.';

select 'OK - Đã thêm 5 cột tổng hợp cho so_tron.' as result;
