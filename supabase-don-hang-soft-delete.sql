-- Soft delete cho bảng đơn hàng (/don-hang)
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại nhiều lần.
-- Sau khi chạy: nút Xóa trên màn hình đơn hàng chỉ ẩn (deleted_at), không mất dữ liệu.
-- Khôi phục: POST /api/don-hang/:id/restore. Xóa vĩnh viễn: DELETE /api/don-hang/:id?hard=1.

alter table public.don_hang
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by text null;

create index if not exists don_hang_deleted_at_idx on public.don_hang (deleted_at);

comment on column public.don_hang.deleted_at is 'Soft delete: NULL = đang hoạt động, có giá trị = đã xóa (ẩn khỏi /don-hang, xem lại qua ?includeDeleted=1).';
comment on column public.don_hang.deleted_by is 'Người thực hiện xóa mềm (tùy chọn).';
