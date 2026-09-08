-- Bổ sung nhóm vật tư phụ cho kho_nvl.
-- Chạy trong Supabase SQL Editor của DB chính.

alter table public.kho_nvl
  add column if not exists nhom_vat_tu_phu text;

comment on column public.kho_nvl.nhom_vat_tu_phu is
  'Nhóm vật tư phụ dùng để phân loại danh mục NVL (Băng Dính, Bạt Bọc, Dây Đai, Dung Môi, Màng, Mực In, Tem, Kẹp Sắt).';
