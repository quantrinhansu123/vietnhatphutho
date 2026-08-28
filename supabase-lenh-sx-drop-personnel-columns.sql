-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Dọn các cột phân công nhân sự cũ trên bảng lenh_sx.
-- Lịch làm việc theo ngày/ca/máy lấy từ phan_cong_nhan_su_chi_tiet (Sắp xếp lịch làm việc).

alter table public.lenh_sx
  drop column if exists truong_ca,
  drop column if exists nhan_su_chinh,
  drop column if exists tho_phu,
  drop column if exists hoc_viec,
  drop column if exists phan_cong_nhan_su;
