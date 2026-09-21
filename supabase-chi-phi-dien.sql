-- ============================================================
-- BẢNG CHI PHÍ ĐIỆN (ĐỊNH GIÁ THEO NĂM VÀ LOẠI/NHÓM MÁY)
-- Phục vụ màn hình /hcns -> Chi phí điện
-- Thành phẩm (kg) tổng hợp từ sổ trộn (so_tron) theo Loại/Nhóm
-- của danh sách máy (danh_sach_may.loai_may/nhom_may).
-- Quy ước: thang = 0 nghĩa là cả năm (không dùng tháng).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.chi_phi_dien (
  id uuid primary key default gen_random_uuid(),
  thang integer not null,
  nam integer not null,
  ten_bao_cao text not null default '',
  loai_may_list jsonb not null default '[]'::jsonb,
  tong_tien_dien numeric(16,0) not null default 0,
  tong_thanh_pham numeric(12,2) not null default 0,
  tb_dong_kg numeric(12,0) not null default 0,
  chi_tiet jsonb not null default '{}'::jsonb,
  ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Thêm các cột nếu đã tồn tại bảng cũ
alter table public.chi_phi_dien
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists ten_bao_cao text,
  add column if not exists loai_may_list jsonb,
  add column if not exists tong_tien_dien numeric(16,0),
  add column if not exists tong_thanh_pham numeric(12,2),
  add column if not exists tb_dong_kg numeric(12,0),
  add column if not exists chi_tiet jsonb,
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Index tra cứu theo năm, tháng
create index if not exists idx_chi_phi_dien_nam_thang
  on public.chi_phi_dien (nam, thang);

create index if not exists idx_chi_phi_dien_created_at
  on public.chi_phi_dien (created_at desc);

-- RLS
alter table public.chi_phi_dien enable row level security;

drop policy if exists "chi_phi_dien_select_all" on public.chi_phi_dien;
create policy "chi_phi_dien_select_all"
  on public.chi_phi_dien for select
  using (true);

drop policy if exists "chi_phi_dien_insert_all" on public.chi_phi_dien;
create policy "chi_phi_dien_insert_all"
  on public.chi_phi_dien for insert
  with check (true);

drop policy if exists "chi_phi_dien_update_all" on public.chi_phi_dien;
create policy "chi_phi_dien_update_all"
  on public.chi_phi_dien for update
  using (true)
  with check (true);

drop policy if exists "chi_phi_dien_delete_all" on public.chi_phi_dien;
create policy "chi_phi_dien_delete_all"
  on public.chi_phi_dien for delete
  using (true);

comment on table public.chi_phi_dien is 'Bảng lưu trữ chi phí tiền điện theo tháng và loại/nhóm máy (thành phẩm tổng hợp từ sổ trộn).';
