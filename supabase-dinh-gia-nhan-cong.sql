-- ============================================================
-- BẢNG LƯU BÁO CÁO ĐỊNH GIÁ NHÂN CÔNG (THEO THÁNG / THEO NĂM)
-- Phục vụ nút "Định giá" trong màn hình /chi-phi-nhan-cong
-- loai = 'thang': so sánh tháng này với tháng trước (hoặc tháng tùy chọn)
-- loai = 'nam': so sánh năm này với năm trước
--   + che_do_nam = 'cung-thang': cùng 1 tháng ở 2 năm (VD T8/2026 vs T8/2025)
--   + che_do_nam = 'cong-don': cộng dồn chi phí & sản lượng theo phạm vi tháng
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.dinh_gia_nhan_cong (
  id uuid primary key default gen_random_uuid(),
  loai text not null default 'thang',
  thang integer,
  nam integer not null,
  thang_so_sanh integer,
  nam_so_sanh integer,
  che_do_nam text,
  tu_thang integer,
  den_thang integer,
  ten_bao_cao text not null default '',
  ma_may_list jsonb not null default '[]'::jsonb,
  ten_may_list jsonb not null default '[]'::jsonb,
  chi_tiet jsonb not null default '{}'::jsonb,
  ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Thêm các cột nếu đã tồn tại bảng cũ
alter table public.dinh_gia_nhan_cong
  add column if not exists loai text,
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists thang_so_sanh integer,
  add column if not exists nam_so_sanh integer,
  add column if not exists che_do_nam text,
  add column if not exists tu_thang integer,
  add column if not exists den_thang integer,
  add column if not exists ten_bao_cao text,
  add column if not exists ma_may_list jsonb,
  add column if not exists ten_may_list jsonb,
  add column if not exists chi_tiet jsonb,
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Index tra cứu theo loại + năm
create index if not exists idx_dinh_gia_nhan_cong_loai_nam
  on public.dinh_gia_nhan_cong (loai, nam);

create index if not exists idx_dinh_gia_nhan_cong_created_at
  on public.dinh_gia_nhan_cong (created_at desc);

-- RLS
alter table public.dinh_gia_nhan_cong enable row level security;

drop policy if exists "dinh_gia_nhan_cong_select_all" on public.dinh_gia_nhan_cong;
create policy "dinh_gia_nhan_cong_select_all"
  on public.dinh_gia_nhan_cong for select
  using (true);

drop policy if exists "dinh_gia_nhan_cong_insert_all" on public.dinh_gia_nhan_cong;
create policy "dinh_gia_nhan_cong_insert_all"
  on public.dinh_gia_nhan_cong for insert
  with check (true);

drop policy if exists "dinh_gia_nhan_cong_update_all" on public.dinh_gia_nhan_cong;
create policy "dinh_gia_nhan_cong_update_all"
  on public.dinh_gia_nhan_cong for update
  using (true)
  with check (true);

drop policy if exists "dinh_gia_nhan_cong_delete_all" on public.dinh_gia_nhan_cong;
create policy "dinh_gia_nhan_cong_delete_all"
  on public.dinh_gia_nhan_cong for delete
  using (true);

comment on table public.dinh_gia_nhan_cong is 'Bảng lưu trữ báo cáo định giá định mức nhân công (đồng/kg) theo tháng và theo năm.';
