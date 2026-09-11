-- Cho phép để trống giờ bắt đầu / giờ kết thúc khi điều động nhân sự.
-- Lỗi: null value in column "thoi_gian_bat_dau" violates not-null constraint

begin;

alter table public.dieu_dong_nhan_su
  alter column thoi_gian_bat_dau drop not null;

alter table public.dieu_dong_nhan_su
  alter column thoi_gian_ket_thuc drop not null;

comment on column public.dieu_dong_nhan_su.thoi_gian_bat_dau is
  'Giờ bắt đầu điều động (tuỳ chọn). Trống thì không hiển thị "làm lúc" trên lịch in.';

comment on column public.dieu_dong_nhan_su.thoi_gian_ket_thuc is
  'Giờ kết thúc điều động (tuỳ chọn). Trống thì không hiển thị "về lúc" trên lịch in.';

commit;
