-- Run in Supabase SQL Editor (one-time).
-- Fix rounding (e.g. 0.0238 -> 0.024) by increasing numeric scale.

alter table public.kho_nvl
  alter column tong_trong_luong type numeric(18,6) using tong_trong_luong::numeric,
  alter column trong_luong_nhua type numeric(18,6) using trong_luong_nhua::numeric,
  alter column trong_luong_tui type numeric(18,6) using trong_luong_tui::numeric,
  alter column trong_luong_loi type numeric(18,6) using trong_luong_loi::numeric,
  alter column kho_cuon type numeric(18,6) using kho_cuon::numeric,
  alter column chieu_dai_don_vi type numeric(18,6) using chieu_dai_don_vi::numeric;

