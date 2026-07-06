-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Thêm cột tên đăng nhập và mật khẩu cho bảng nhan_su

alter table public.nhan_su
  add column if not exists ten_dang_nhap text,
  add column if not exists mat_khau text;

comment on column public.nhan_su.ten_dang_nhap is 'Ten dang nhap he thong.';
comment on column public.nhan_su.mat_khau is 'Mat khau dang nhap.';
