-- Bắt buộc ngày trên phiếu trộn định mức.
-- Chạy trong Supabase SQL Editor; an toàn khi chạy lại.

update public.bang_tron_vat_tu_dinh_muc
set ngay = coalesce(ngay, created_at::date, current_date)
where ngay is null;

alter table public.bang_tron_vat_tu_dinh_muc
  alter column ngay set not null;
