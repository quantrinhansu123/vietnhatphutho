-- Quyền xem menu theo nhân sự (menu cha + menu con)
-- Chạy trong Supabase SQL Editor

alter table public.nhan_su
  add column if not exists quyen_xem jsonb not null default '[]'::jsonb;

comment on column public.nhan_su.quyen_xem is
  'Danh sach menu duoc xem: [{ menu, label, children: [{ tab, label }] }].';
