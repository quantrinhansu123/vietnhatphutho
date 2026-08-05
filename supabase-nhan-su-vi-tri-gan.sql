-- Gán nhiều vị trí quyền theo mã nhân viên (jsonb)
-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)

alter table public.nhan_su
  add column if not exists vi_tri_gan jsonb not null default '[]'::jsonb;

comment on column public.nhan_su.vi_tri_gan is
  'Danh sach vi tri duoc gan: [{ department, position, permissionKey }]. Khoa theo ma_nhan_su.';
