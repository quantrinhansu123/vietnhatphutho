-- Chạy lại an toàn trong Supabase SQL Editor
-- Bổ sung cột phục vụ "Xem trước khi in" của lệnh sản xuất (/lenh-sx)

alter table public.lenh_sx
  add column if not exists ma_so text,
  add column if not exists ngay_lien_lac date,
  add column if not exists dac_ta text,
  add column if not exists lan_ban_hanh text;

comment on column public.lenh_sx.ma_so is 'Mã số biểu mẫu in lệnh sản xuất.';
comment on column public.lenh_sx.ngay_lien_lac is 'Ngày liên lạc trên bản in lệnh sản xuất.';
comment on column public.lenh_sx.dac_ta is 'Đặc tả / ghi chú đầu trang bản in lệnh sản xuất.';
comment on column public.lenh_sx.lan_ban_hanh is 'Lần ban hành của bản in lệnh sản xuất.';
