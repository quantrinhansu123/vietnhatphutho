-- Hao hụt thống kê theo máy/ca trong Báo cáo ngày (tab 2 màn hình /bao-cao-ngay)
-- Chạy 1 lần trong Supabase SQL Editor. An toàn chạy lại nhiều lần.
alter table if exists public.bao_cao_ngay
  add column if not exists hao_hut_thong_ke jsonb not null default '[]'::jsonb;

comment on column public.bao_cao_ngay.hao_hut_thong_ke is 'Hao hụt thống kê: [{ma_may, ten_may, muc_tieu, rows: [{ca, truong_ca, ghi_chep: [text], danh_gia}]}] — tổng hợp từ sổ trộn theo máy/ca, SL mục tiêu + ghi chép nhập tay.';

select 'OK - Đã thêm cột bao_cao_ngay.hao_hut_thong_ke.' as result;
