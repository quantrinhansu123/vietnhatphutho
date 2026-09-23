-- Tach bang phieu_xuat_nhap_kho -> phieu_nhap_kho + phieu_xuat_kho
-- File 1/3: bang PHIEU NHAP. Chay trong Supabase SQL Editor. Idempotent.
--
-- Nguyen tac:
--   - Giu NGUYEN id (uuid) khi backfill de lien ket xuat->nhap
--     (id_dong_nhap_nguon) khong dut.
--   - Giu cot loai_phieu (default 'nhap' + CHECK) trong giai doan chuyen doi
--     de code cu van insert/select duoc; se drop o dot don dep sau.
--   - Schema sao y toan bo cot cua phieu_xuat_nhap_kho (goc + ~20 migration).

create table if not exists public.phieu_nhap_kho (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ma_phieu text,
  loai_phieu text not null default 'nhap',
  ngay_phieu date,
  ca text,
  ca_list text[],
  may text,
  ma_npl text,
  ten_npl text,
  ten_nvl_sx text,
  ma_sp text,
  ten_sp text,
  don_vi text,
  so_luong numeric,
  so_luong_chung_tu numeric,
  don_gia numeric,
  thanh_tien numeric,
  ly_do text,
  ghi_chu text,
  nguoi_lap text,
  nhan_su text,
  nguoi_giao text,
  loai_kho text default 'nvl',
  ten_kho text,
  dia_diem text,
  dia_chi text,
  loai_nhap_kho text,
  so_tron_ids text[],
  id_dong_nhap_nguon uuid,
  ma_phieu_nhap_nguon text,
  can_cu_bao_cao text,
  phan_loai_nvl text,
  trong_luong_kg numeric,
  nhom_vthh text,
  so_m2 numeric,
  so_m_dai numeric,
  ton_dau_ca_may numeric,
  treo boolean not null default false,
  link_anh_can_thuc_te text,
  link_anh_can_thuc_te_public_id text,
  link_anh_bao_thuc_te text,
  link_anh_bao_thuc_te_public_id text
);

-- Rang buoc loai phieu (khoa mem giai doan chuyen doi; drop sau khi code cu nghi dung).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'phieu_nhap_kho_loai_phieu_check'
  ) then
    alter table public.phieu_nhap_kho
      add constraint phieu_nhap_kho_loai_phieu_check check (loai_phieu = 'nhap');
  end if;
end
$$;

create index if not exists phieu_nhap_kho_ma_phieu_idx on public.phieu_nhap_kho (ma_phieu);
create index if not exists phieu_nhap_kho_ngay_phieu_idx on public.phieu_nhap_kho (ngay_phieu desc);
create index if not exists phieu_nhap_kho_loai_kho_idx on public.phieu_nhap_kho (loai_kho);
create index if not exists phieu_nhap_kho_ten_kho_idx on public.phieu_nhap_kho (ten_kho);
create index if not exists phieu_nhap_kho_ma_npl_idx on public.phieu_nhap_kho (ma_npl);
create index if not exists phieu_nhap_kho_ma_sp_idx on public.phieu_nhap_kho (ma_sp);
create index if not exists phieu_nhap_kho_treo_idx on public.phieu_nhap_kho (treo) where treo = true;

alter table public.phieu_nhap_kho enable row level security;

drop policy if exists "phieu_nhap_kho_select_all" on public.phieu_nhap_kho;
create policy "phieu_nhap_kho_select_all"
  on public.phieu_nhap_kho for select
  using (true);

drop policy if exists "phieu_nhap_kho_insert_all" on public.phieu_nhap_kho;
create policy "phieu_nhap_kho_insert_all"
  on public.phieu_nhap_kho for insert
  with check (true);

drop policy if exists "phieu_nhap_kho_update_all" on public.phieu_nhap_kho;
create policy "phieu_nhap_kho_update_all"
  on public.phieu_nhap_kho for update
  using (true)
  with check (true);

drop policy if exists "phieu_nhap_kho_delete_all" on public.phieu_nhap_kho;
create policy "phieu_nhap_kho_delete_all"
  on public.phieu_nhap_kho for delete
  using (true);

comment on table public.phieu_nhap_kho is 'Phieu NHAP kho — tach tu phieu_xuat_nhap_kho (moi dong la mot mat hang trong phieu). Giu nguyen id khi backfill.';
comment on column public.phieu_nhap_kho.ma_phieu is 'Ma phieu nhap (prefix PN-), gom nhieu dong chi tiet.';
