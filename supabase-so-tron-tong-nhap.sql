-- Sổ trộn: thêm Tổng Nhập Trong Ngày (tong_nhap_nvl = Σ lay_trong_kho bảng bàn giao).
-- Chạy 1 lần trong Supabase SQL Editor (an toàn khi chạy lại).

alter table public.so_tron
  add column if not exists tong_nhap_nvl numeric not null default 0;

comment on column public.so_tron.tong_nhap_nvl is 'Tổng Nhập Trong Ngày (kg) = Σ lay_trong_kho (Nhập Trong Ngày) trong bang_ban_giao. Frontend tự tính khi lưu.';

select 'OK - Đã thêm cột tong_nhap_nvl cho so_tron.' as result;
