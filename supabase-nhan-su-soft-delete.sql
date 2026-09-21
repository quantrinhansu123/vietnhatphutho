-- Soft delete cho bảng nhân sự (/nhan-su)
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại nhiều lần.
-- Sau khi chạy: DELETE trên màn hình nhân sự chỉ ẩn (deleted_at), không mất dữ liệu.

alter table public.nhan_su
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by text null;

create index if not exists nhan_su_deleted_at_idx on public.nhan_su (deleted_at);

comment on column public.nhan_su.deleted_at is 'Soft delete: NULL = đang hoạt động, có giá trị = đã xóa (ẩn khỏi /nhan-su).';
comment on column public.nhan_su.deleted_by is 'Người thực hiện xóa mềm (tùy chọn).';
