-- Ghi chú chung dưới bảng Hao hụt thống kê (tab 2 màn hình /bao-cao-ngay)
-- Chạy 1 lần trong Supabase SQL Editor. An toàn chạy lại nhiều lần.
alter table if exists public.bao_cao_ngay
  add column if not exists hao_hut_ghi_chu text not null default '';

comment on column public.bao_cao_ngay.hao_hut_ghi_chu is 'Ghi chú chung dưới bảng Hao hụt thống kê (tab 2 /bao-cao-ngay).';

select 'OK - Đã thêm cột bao_cao_ngay.hao_hut_ghi_chu.' as result;
