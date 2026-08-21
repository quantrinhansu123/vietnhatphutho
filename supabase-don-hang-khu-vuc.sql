-- Thêm cột khu_vuc vào bảng don_hang
-- Khu vực được lấy từ nhân sự (Bắc, Trung, Nam)

alter table public.don_hang
  add column if not exists khu_vuc text;

comment on column public.don_hang.khu_vuc is 'Khu vực xuất hàng: Bắc, Trung, Nam (được lấy từ nhân sự)';
