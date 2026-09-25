-- Phiếu nhập / xuất tổng hợp: 1 header, kho hoặc máy chọn trên từng dòng.
-- Sinh vế phieu_nhap_kho / phieu_xuat_kho. Hủy sinh phiếu đảo, không xóa vế lẻ.
-- Chạy an toàn khi chạy lại. Không đụng phieu_chuyen_kho.

create extension if not exists pgcrypto;

create table if not exists public.phieu_nhap_xuat_tong_hop (
  id uuid primary key default gen_random_uuid(),
  ma_phieu_chung text not null,
  loai text not null,
  ngay date not null,
  kho_dich text not null default '',
  nguon_loai text,
  nguon_id text,
  dich_loai text,
  dich_id text,
  ca text,
  loai_nhap text,
  loai_xuat text,
  chi_tiet jsonb not null default '[]'::jsonb,
  ma_phieu_nhap text,
  ma_phieu_xuat text,
  ma_phieu_nhap_huy text,
  ma_phieu_xuat_huy text,
  trang_thai text not null default 'hoan_thanh',
  nguoi_lap text,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phieu_nhap_xuat_tong_hop_loai_check check (loai in ('nhap', 'xuat'))
);

alter table public.phieu_nhap_xuat_tong_hop
  add column if not exists ma_phieu_chung text,
  add column if not exists loai text,
  add column if not exists ngay date,
  add column if not exists kho_dich text,
  add column if not exists nguon_loai text,
  add column if not exists nguon_id text,
  add column if not exists dich_loai text,
  add column if not exists dich_id text,
  add column if not exists ca text,
  add column if not exists loai_nhap text,
  add column if not exists loai_xuat text,
  add column if not exists chi_tiet jsonb,
  add column if not exists ma_phieu_nhap text,
  add column if not exists ma_phieu_xuat text,
  add column if not exists ma_phieu_nhap_huy text,
  add column if not exists ma_phieu_xuat_huy text,
  add column if not exists trang_thai text,
  add column if not exists nguoi_lap text,
  add column if not exists nguoi_giao text,
  add column if not exists dia_diem text,
  add column if not exists ly_do text,
  add column if not exists ghi_chu text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'phieu_nhap_xuat_tong_hop_loai_check'
  ) then
    alter table public.phieu_nhap_xuat_tong_hop
      add constraint phieu_nhap_xuat_tong_hop_loai_check check (loai in ('nhap', 'xuat'));
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'phieu_nhap_xuat_tong_hop_ma_phieu_chung_key'
  ) then
    alter table public.phieu_nhap_xuat_tong_hop
      add constraint phieu_nhap_xuat_tong_hop_ma_phieu_chung_key unique (ma_phieu_chung);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists phieu_nhap_xuat_tong_hop_ngay_idx
  on public.phieu_nhap_xuat_tong_hop (ngay desc);
create index if not exists phieu_nhap_xuat_tong_hop_loai_idx
  on public.phieu_nhap_xuat_tong_hop (loai);
create index if not exists phieu_nhap_xuat_tong_hop_trang_thai_idx
  on public.phieu_nhap_xuat_tong_hop (trang_thai);

create or replace function public.set_phieu_nhap_xuat_tong_hop_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_phieu_nhap_xuat_tong_hop_updated_at on public.phieu_nhap_xuat_tong_hop;
create trigger trg_phieu_nhap_xuat_tong_hop_updated_at
before update on public.phieu_nhap_xuat_tong_hop
for each row execute function public.set_phieu_nhap_xuat_tong_hop_updated_at();

alter table public.phieu_nhap_xuat_tong_hop enable row level security;

drop policy if exists "phieu_nhap_xuat_tong_hop_select_all" on public.phieu_nhap_xuat_tong_hop;
create policy "phieu_nhap_xuat_tong_hop_select_all"
  on public.phieu_nhap_xuat_tong_hop for select using (true);
drop policy if exists "phieu_nhap_xuat_tong_hop_insert_all" on public.phieu_nhap_xuat_tong_hop;
create policy "phieu_nhap_xuat_tong_hop_insert_all"
  on public.phieu_nhap_xuat_tong_hop for insert with check (true);
drop policy if exists "phieu_nhap_xuat_tong_hop_update_all" on public.phieu_nhap_xuat_tong_hop;
create policy "phieu_nhap_xuat_tong_hop_update_all"
  on public.phieu_nhap_xuat_tong_hop for update using (true) with check (true);
drop policy if exists "phieu_nhap_xuat_tong_hop_delete_all" on public.phieu_nhap_xuat_tong_hop;
create policy "phieu_nhap_xuat_tong_hop_delete_all"
  on public.phieu_nhap_xuat_tong_hop for delete using (true);

grant select, insert, update, delete on public.phieu_nhap_xuat_tong_hop to anon, authenticated, service_role;

select 'OK - bảng phieu_nhap_xuat_tong_hop.' as result;
