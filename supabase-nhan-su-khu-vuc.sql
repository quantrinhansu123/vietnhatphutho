-- Thêm cột khu_vuc vào bảng nhan_su
-- Hỗ trợ 3 khu vực: Bắc, Trung, Nam (không bắt buộc)

alter table public.nhan_su
  add column if not exists khu_vuc text;

comment on column public.nhan_su.khu_vuc is 'Khu vực công tác của nhân sự: Bắc, Trung, Nam';
