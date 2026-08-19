-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại).
-- Thời điểm cập nhật cuối cùng của đơn hàng, dùng để sắp xếp danh sách.
alter table public.don_hang
  add column if not exists updated_at timestamptz not null default now();

update public.don_hang
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

comment on column public.don_hang.updated_at is
  'Thời điểm cập nhật cuối cùng của đơn hàng.';
