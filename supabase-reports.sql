-- Bảng báo cáo sản xuất (tab Phân tích / Nhập báo cáo)
-- Chạy trong Supabase SQL Editor nếu gặp lỗi PGRST205: table 'public.reports' not found

create table if not exists public.reports (
  id text primary key,
  date date not null,
  "shiftInfo" jsonb not null,
  "productEntry" jsonb not null,
  materials jsonb not null,
  "wasteWeight" numeric not null default 0,
  notes text,
  "createdAt" timestamptz not null default now()
);

create index if not exists reports_date_idx on public.reports (date desc);
create index if not exists reports_created_at_idx on public.reports ("createdAt" desc);

comment on table public.reports is 'Bao cao san xuat — dong bo tu app Nhap bao cao / Phan tich.';
