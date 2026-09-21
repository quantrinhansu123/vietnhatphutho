-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Bảng lưu trữ Báo cáo tháng (tổng hợp từ các đợt sản xuất trong tháng theo máy)
-- Phục vụ báo cáo "KẾT QUẢ ĐỊNH GIÁ VẬT TƯ - NHÂN CÔNG THỰC TẾ SẢN XUẤT THÁNG X/YYYY"

create extension if not exists pgcrypto;

create table if not exists public.bao_cao_thang (
  id uuid primary key default gen_random_uuid(),
  ten_bao_cao text not null,
  thang integer not null,
  nam integer not null,
  ma_may text not null default '',
  ten_may text not null default '',
  dot_ids jsonb not null default '[]'::jsonb,
  dot_snapshot jsonb not null default '[]'::jsonb,
  so_dot integer not null default 0,
  -- Tổng hợp vật tư từ các đợt sản xuất
  tong_tl_nvl_chinh numeric(14,3) not null default 0,
  tong_tien_nvl_chinh numeric(16,0) not null default 0,
  tong_tl_nvl_phu numeric(14,3) not null default 0,
  tong_tien_nvl_phu numeric(16,0) not null default 0,
  thu_hoi_phe_tl numeric(14,3) not null default 0,
  thu_hoi_phe_tien numeric(16,0) not null default 0,
  hao_hut_kg numeric(14,3) not null default 0,
  tl_chinh_thuc_te numeric(14,3) not null default 0,
  gia_vt_tt_hao_hut numeric(14,2),
  chenh_lech_hao_hut numeric(14,2),
  ti_le_hao_hut numeric(8,4),
  -- Tổng hợp nhân công thực tế từ các đợt sản xuất
  so_cong_truc numeric(10,2) not null default 0,
  so_cong_dau_may numeric(10,2) not null default 0,
  so_cong_cuoi_may numeric(10,2) not null default 0,
  tong_chi_phi_nhan_cong numeric(16,0) not null default 0,
  ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bao_cao_thang
  add column if not exists ten_bao_cao text,
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists ma_may text,
  add column if not exists ten_may text,
  add column if not exists dot_ids jsonb,
  add column if not exists dot_snapshot jsonb,
  add column if not exists so_dot integer,
  add column if not exists tong_tl_nvl_chinh numeric(14,3),
  add column if not exists tong_tien_nvl_chinh numeric(16,0),
  add column if not exists tong_tl_nvl_phu numeric(14,3),
  add column if not exists tong_tien_nvl_phu numeric(16,0),
  add column if not exists thu_hoi_phe_tl numeric(14,3),
  add column if not exists thu_hoi_phe_tien numeric(16,0),
  add column if not exists hao_hut_kg numeric(14,3),
  add column if not exists tl_chinh_thuc_te numeric(14,3),
  add column if not exists gia_vt_tt_hao_hut numeric(14,2),
  add column if not exists chenh_lech_hao_hut numeric(14,2),
  add column if not exists ti_le_hao_hut numeric(8,4),
  add column if not exists so_cong_truc numeric(10,2),
  add column if not exists so_cong_dau_may numeric(10,2),
  add column if not exists so_cong_cuoi_may numeric(10,2),
  add column if not exists tong_chi_phi_nhan_cong numeric(16,0),
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_bao_cao_thang_nam_thang on public.bao_cao_thang (nam desc, thang desc);
create index if not exists idx_bao_cao_thang_ma_may on public.bao_cao_thang (ma_may);

alter table public.bao_cao_thang enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bao_cao_thang' and policyname = 'bao_cao_thang_anon_all'
  ) then
    create policy bao_cao_thang_anon_all on public.bao_cao_thang
      for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bao_cao_thang' and policyname = 'bao_cao_thang_auth_all'
  ) then
    create policy bao_cao_thang_auth_all on public.bao_cao_thang
      for all to authenticated using (true) with check (true);
  end if;
end $$;
