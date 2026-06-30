-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Thêm cột vị trí và thứ tự ưu tiên cho kế hoạch sản xuất trên bảng lenh_sx.

alter table public.lenh_sx
  add column if not exists vi_tri text,
  add column if not exists thu_tu_uu_tien integer default 0;

comment on column public.lenh_sx.vi_tri is
  'Vị trí sản xuất: máy, dây chuyền hoặc khu vực được gán trong kế hoạch SX.';
comment on column public.lenh_sx.thu_tu_uu_tien is
  'Thứ tự ưu tiên trong kế hoạch SX (1 = cao nhất).';

create index if not exists lenh_sx_thu_tu_uu_tien_idx
  on public.lenh_sx (thu_tu_uu_tien asc nulls last);
