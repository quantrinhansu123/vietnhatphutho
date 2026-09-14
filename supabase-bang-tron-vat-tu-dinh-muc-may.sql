-- Migration: Thêm cột may cho bảng bang_tron_vat_tu_dinh_muc
-- Phiếu trộn định mức chọn nhiều lệnh SX cùng máy; máy phiếu in cạnh tiêu đề.
-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)

alter table public.bang_tron_vat_tu_dinh_muc
  add column if not exists may text;

comment on column public.bang_tron_vat_tu_dinh_muc.may is
  'May cua phieu tron dinh muc (mac dinh theo may chung cua cac lenh SX).';
