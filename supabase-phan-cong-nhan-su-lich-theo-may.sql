-- Lịch làm việc (module Sắp xếp lịch) chuyển sang gom theo Máy + Ngày + Ca,
-- không còn bắt buộc gắn với 1 lệnh sản xuất → id_lenh_sx được phép NULL.

alter table public.phan_cong_nhan_su_chi_tiet
alter column id_lenh_sx drop not null;

comment on column public.phan_cong_nhan_su_chi_tiet.id_lenh_sx is 'FK lenh_sx.id (nullable) - lich lam viec theo may/ngay/ca co the khong gan lenh SX.';
