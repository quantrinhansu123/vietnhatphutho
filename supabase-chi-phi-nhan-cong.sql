-- ============================================================
-- BẢNG CHI PHÍ NHÂN CÔNG (THEO THÁNG VÀ MÁY)
-- Phục vụ màn hình /hcns -> Chi phí nhân công
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.chi_phi_nhan_cong (
  id uuid primary key default gen_random_uuid(),
  thang integer not null,
  nam integer not null,
  ten_bao_cao text not null default '',
  ma_may_list jsonb not null default '[]'::jsonb,
  ten_may_list jsonb not null default '[]'::jsonb,
  tong_so_nguoi integer not null default 0,
  tong_so_gio numeric(12,2) not null default 0,
  tong_so_cong numeric(12,2) not null default 0,
  tong_chi_phi numeric(16,0) not null default 0,
  chi_tiet jsonb not null default '{}'::jsonb,
  ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Thêm các cột nếu đã tồn tại bảng cũ
alter table public.chi_phi_nhan_cong
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists ten_bao_cao text,
  add column if not exists ma_may_list jsonb,
  add column if not exists ten_may_list jsonb,
  add column if not exists tong_so_nguoi integer,
  add column if not exists tong_so_gio numeric(12,2),
  add column if not exists tong_so_cong numeric(12,2),
  add column if not exists tong_chi_phi numeric(16,0),
  add column if not exists chi_tiet jsonb,
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Index tra cứu theo năm, tháng
create index if not exists idx_chi_phi_nhan_cong_nam_thang
  on public.chi_phi_nhan_cong (nam, thang);

create index if not exists idx_chi_phi_nhan_cong_created_at
  on public.chi_phi_nhan_cong (created_at desc);

-- RLS
alter table public.chi_phi_nhan_cong enable row level security;

drop policy if exists "chi_phi_nhan_cong_select_all" on public.chi_phi_nhan_cong;
create policy "chi_phi_nhan_cong_select_all"
  on public.chi_phi_nhan_cong for select
  using (true);

drop policy if exists "chi_phi_nhan_cong_insert_all" on public.chi_phi_nhan_cong;
create policy "chi_phi_nhan_cong_insert_all"
  on public.chi_phi_nhan_cong for insert
  with check (true);

drop policy if exists "chi_phi_nhan_cong_update_all" on public.chi_phi_nhan_cong;
create policy "chi_phi_nhan_cong_update_all"
  on public.chi_phi_nhan_cong for update
  using (true)
  with check (true);

drop policy if exists "chi_phi_nhan_cong_delete_all" on public.chi_phi_nhan_cong;
create policy "chi_phi_nhan_cong_delete_all"
  on public.chi_phi_nhan_cong for delete
  using (true);

comment on table public.chi_phi_nhan_cong is 'Bảng lưu trữ tổng hợp chi phí nhân công theo tháng và máy.';
