-- Migration: Thêm cột ten_phieu cho bảng bang_tron_vat_tu_dinh_muc
-- Tên phiếu tự động: PTĐM + ngày + ca + lệnh sản xuất

alter table public.bang_tron_vat_tu_dinh_muc
  add column if not exists ten_phieu text;

-- Backfill tên phiếu cho dữ liệu hiện có nếu chưa có
update public.bang_tron_vat_tu_dinh_muc
set ten_phieu = concat_ws(' - ', 'PTĐM', ngay::text, nullif(ca, ''), nullif(ma_lenh_sx, ''))
where ten_phieu is null or ten_phieu = '';

comment on column public.bang_tron_vat_tu_dinh_muc.ten_phieu is
  'Tên phiếu trộn định mức: tự động ghép PTĐM + ngày + ca + lệnh sản xuất';
