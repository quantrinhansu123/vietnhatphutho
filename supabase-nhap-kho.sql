-- nhap_kho — sổ thông tin sản phẩm nhập kho thành phẩm.
-- 1 dòng sản phẩm trên phiếu nhập TP = 1 dòng nhap_kho.
-- Thông tin chứng từ phiếu vẫn ở phieu_xuat_nhap_kho.
-- Chạy an toàn khi chạy lại.

create extension if not exists pgcrypto;

create table if not exists public.nhap_kho (
  id uuid primary key default gen_random_uuid(),
  ma_sp text not null default '',
  ten_sp text not null default '',
  don_vi text not null default '',
  trong_luong_kg_mot_sp numeric,
  so_m2_mot_sp numeric,
  so_m_dai_mot_sp numeric,
  loai_kho text not null,
  ten_kho text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrate từ schema nhật ký quét mã cũ → sổ SP nhập TP.
alter table public.nhap_kho
  add column if not exists ma_sp text not null default '',
  add column if not exists ten_sp text not null default '',
  add column if not exists don_vi text not null default '',
  add column if not exists trong_luong_kg_mot_sp numeric,
  add column if not exists so_m2_mot_sp numeric,
  add column if not exists so_m_dai_mot_sp numeric,
  add column if not exists loai_kho text,
  add column if not exists ten_kho text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Bỏ cột nhật ký quét (không dùng cho sổ SP).
alter table public.nhap_kho
  drop column if exists loai,
  drop column if exists ngay_gio,
  drop column if exists nguoi_thuc_hien,
  drop column if exists ngay,
  drop column if exists ca;

-- Sổ SP chỉ giữ hệ số 1 sản phẩm. Tổng SL / kg / m2 / m dài nằm trên phiếu.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'nhap_kho'
      and column_name = 'so_luong'
  ) then
    update public.nhap_kho
    set
      trong_luong_kg_mot_sp = case
        when so_luong is not null and so_luong > 0 and trong_luong_kg is not null
          then round(trong_luong_kg / so_luong, 6)
        else trong_luong_kg_mot_sp
      end,
      so_m2_mot_sp = case
        when so_luong is not null and so_luong > 0 and so_m2 is not null
          then round(so_m2 / so_luong, 6)
        else so_m2_mot_sp
      end,
      so_m_dai_mot_sp = case
        when so_luong is not null and so_luong > 0 and so_m_dai is not null
          then round(so_m_dai / so_luong, 6)
        else so_m_dai_mot_sp
      end
    where trong_luong_kg_mot_sp is null
       or so_m2_mot_sp is null
       or so_m_dai_mot_sp is null;
  end if;
end $$;

alter table public.nhap_kho
  drop column if exists so_luong,
  drop column if exists trong_luong_kg,
  drop column if exists so_m2,
  drop column if exists so_m_dai;

-- loai_kho bắt buộc, không default (ghi rõ 'thanh_pham' từ app).
alter table public.nhap_kho
  alter column loai_kho drop default;

update public.nhap_kho
set loai_kho = 'thanh_pham'
where loai_kho is null or btrim(loai_kho) = '';

alter table public.nhap_kho
  alter column loai_kho set not null;

create index if not exists nhap_kho_ma_sp_idx on public.nhap_kho (ma_sp);
create index if not exists nhap_kho_loai_kho_idx on public.nhap_kho (loai_kho);
create index if not exists nhap_kho_ten_kho_idx on public.nhap_kho (ten_kho);

create or replace function public.set_nhap_kho_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nhap_kho_updated_at on public.nhap_kho;
create trigger trg_nhap_kho_updated_at
before update on public.nhap_kho
for each row execute function public.set_nhap_kho_updated_at();

alter table public.nhap_kho enable row level security;

drop policy if exists "nhap_kho_select_all" on public.nhap_kho;
create policy "nhap_kho_select_all" on public.nhap_kho for select using (true);
drop policy if exists "nhap_kho_insert_all" on public.nhap_kho;
create policy "nhap_kho_insert_all" on public.nhap_kho for insert with check (true);
drop policy if exists "nhap_kho_update_all" on public.nhap_kho;
create policy "nhap_kho_update_all" on public.nhap_kho for update using (true) with check (true);
drop policy if exists "nhap_kho_delete_all" on public.nhap_kho;
create policy "nhap_kho_delete_all" on public.nhap_kho for delete using (true);

grant select, insert, update, delete on public.nhap_kho to anon, authenticated, service_role;

comment on table public.nhap_kho is
  'So thong tin san pham nhap kho thanh pham. 1 dong SP tren phieu nhap TP = 1 dong. loai_kho = thanh_pham.';
comment on column public.nhap_kho.ma_sp is 'Ma san pham (co the kem hau to lo/serial).';
comment on column public.nhap_kho.ten_sp is 'Ten san pham snapshot luc nhap.';
comment on column public.nhap_kho.don_vi is 'Don vi tinh.';
comment on column public.nhap_kho.trong_luong_kg_mot_sp is 'Kg cua 1 san pham — he so quy doi, khong phai tong dong phieu.';
comment on column public.nhap_kho.so_m2_mot_sp is 'm2 cua 1 san pham.';
comment on column public.nhap_kho.so_m_dai_mot_sp is 'Met dai cua 1 san pham.';
comment on column public.nhap_kho.loai_kho is 'Loai kho: thanh_pham (khong co default — app phai ghi ro).';
comment on column public.nhap_kho.ten_kho is 'Ten kho vat ly.';
