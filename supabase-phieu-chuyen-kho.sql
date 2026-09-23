-- Phiếu chuyển kho thành phẩm: chuyển SP qua lại giữa các kho (TP ↔ cắt lẻ ↔ tái chế...).
-- 1 phiếu chuyển (CK-...) hoàn thành sinh đúng 2 phiếu XN: 1 xuất (kho nguồn) + 1 nhập (kho đích).
-- Hủy phiếu đã hoàn thành sinh thêm 2 phiếu đảo (lý do "Hủy chuyển kho ..."). KHÔNG xóa phiếu.
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

create extension if not exists pgcrypto;

create table if not exists public.phieu_chuyen_kho (
  id uuid primary key default gen_random_uuid(),
  ma_phieu text not null,
  ngay date not null,
  trang_thai text not null default 'moi',
  -- 'moi' | 'hoan_thanh' | 'huy'
  kho_nguon text not null default '',
  kho_dich text not null default '',
  -- Dòng SP: [{ma_sp, ten_sp, don_vi, nhom_vthh, so_luong,
  --   kg_mot_sp, m2_mot_sp, m_dai_mot_sp,
  --   ten_goc, do_li, do_li_dm, do_day_m, do_dai_m, mang, hang_phe, ma_amis}]
  chi_tiet jsonb not null default '[]'::jsonb,
  ma_phieu_xuat text,
  ma_phieu_nhap text,
  -- Phiếu đảo khi hủy (lý do "Hủy chuyển kho ...")
  ma_phieu_xuat_huy text,
  ma_phieu_nhap_huy text,
  nguoi_thuc_hien text,
  nguoi_lap text,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.phieu_chuyen_kho
  add column if not exists ma_phieu text,
  add column if not exists ngay date,
  add column if not exists trang_thai text,
  add column if not exists kho_nguon text,
  add column if not exists kho_dich text,
  add column if not exists chi_tiet jsonb,
  add column if not exists ma_phieu_xuat text,
  add column if not exists ma_phieu_nhap text,
  add column if not exists ma_phieu_xuat_huy text,
  add column if not exists ma_phieu_nhap_huy text,
  add column if not exists nguoi_thuc_hien text,
  add column if not exists nguoi_lap text,
  add column if not exists ghi_chu text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'phieu_chuyen_kho_ma_phieu_key') then
    alter table public.phieu_chuyen_kho add constraint phieu_chuyen_kho_ma_phieu_key unique (ma_phieu);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists phieu_chuyen_kho_ngay_idx on public.phieu_chuyen_kho (ngay desc);
create index if not exists phieu_chuyen_kho_trang_thai_idx on public.phieu_chuyen_kho (trang_thai);

create or replace function public.set_phieu_chuyen_kho_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_phieu_chuyen_kho_updated_at on public.phieu_chuyen_kho;
create trigger trg_phieu_chuyen_kho_updated_at
before update on public.phieu_chuyen_kho
for each row execute function public.set_phieu_chuyen_kho_updated_at();

alter table public.phieu_chuyen_kho enable row level security;

drop policy if exists "phieu_chuyen_kho_select_all" on public.phieu_chuyen_kho;
create policy "phieu_chuyen_kho_select_all" on public.phieu_chuyen_kho for select using (true);
drop policy if exists "phieu_chuyen_kho_insert_all" on public.phieu_chuyen_kho;
create policy "phieu_chuyen_kho_insert_all" on public.phieu_chuyen_kho for insert with check (true);
drop policy if exists "phieu_chuyen_kho_update_all" on public.phieu_chuyen_kho;
create policy "phieu_chuyen_kho_update_all" on public.phieu_chuyen_kho for update using (true) with check (true);
drop policy if exists "phieu_chuyen_kho_delete_all" on public.phieu_chuyen_kho;
create policy "phieu_chuyen_kho_delete_all" on public.phieu_chuyen_kho for delete using (true);

grant select, insert, update, delete on public.phieu_chuyen_kho to anon, authenticated, service_role;

select 'OK - bảng phieu_chuyen_kho.' as result;
