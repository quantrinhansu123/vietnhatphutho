-- Bổ sung hồ sơ giấy tờ xe/lái xe.
-- Cấu trúc: [{ "stt": 1, "ten_giay_to": "Đăng kiểm", "anh": [{ "url": "...", "public_id": "..." }] }]

alter table public.danh_sach_xe
  add column if not exists giay_to jsonb not null default '[]'::jsonb;

comment on column public.danh_sach_xe.giay_to is
  'Danh sách giấy tờ và nhiều ảnh Cloudinary: stt, ten_giay_to, anh[{url, public_id}].';
