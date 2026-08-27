-- Màn hình Điều động nhân sự chuyển sang chọn theo Ngày → nhân sự có lịch làm việc (gom theo máy).
-- Điều động không còn bắt buộc gắn với 1 lệnh sản xuất; bổ sung "ca chuyển đến".

alter table public.dieu_dong_nhan_su
  add column if not exists ca_dieu_dong text;

alter table public.dieu_dong_nhan_su
  alter column ma_lenh_sx drop not null;

alter table public.dieu_dong_nhan_su
  alter column ca drop not null;

comment on column public.dieu_dong_nhan_su.ca is 'Ca goc (ca cua nhan su trong lich lam viec) - nullable.';
comment on column public.dieu_dong_nhan_su.ca_dieu_dong is 'Ca duoc chuyen den (co the khac ca goc).';
comment on column public.dieu_dong_nhan_su.ma_lenh_sx is 'Ma lenh SX tham khao (nullable) - dieu dong theo may/ngay khong bat buoc lenh SX.';
