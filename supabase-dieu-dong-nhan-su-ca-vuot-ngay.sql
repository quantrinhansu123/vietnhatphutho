-- Cho phép lịch điều động vượt ngày, ví dụ 20:00 -> 08:00 hôm sau.
--
-- Hai constraint cũ đều không hỗ trợ ca vượt ngày:
--   1. chk_dieu_dong_thoi_gian yêu cầu giờ kết thúc > giờ bắt đầu.
--   2. ex_dieu_dong_ns_overlap tạo tsrange với cận trên nhỏ hơn cận dưới.
-- Việc kiểm tra giờ trùng nhau và lịch điều động chồng giờ được thực hiện ở API.

begin;

alter table public.dieu_dong_nhan_su
drop constraint if exists ex_dieu_dong_ns_overlap;

alter table public.dieu_dong_nhan_su
drop constraint if exists chk_dieu_dong_thoi_gian;

alter table public.dieu_dong_nhan_su
alter column thoi_gian_ket_thuc drop not null;

commit;
