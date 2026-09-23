-- Lệnh cắt lẻ: 1 lệnh nhiều SP (JSON san_pham).
-- Tạo mới: xuất Kho cắt lẻ + nhập Kho thành phẩm + nhập lại phần còn lại vào Kho cắt lẻ.
-- Phần còn lại dưới 2m: thêm phiếu chuyển kho Kho cắt lẻ -> Kho tái chế.
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

create extension if not exists pgcrypto;

create table if not exists public.lenh_cat_le (
  id uuid primary key default gen_random_uuid(),
  ma_lenh text not null,
  ngay_cat date not null,
  trang_thai text not null default 'moi',
  -- 'moi' | 'hoan_thanh' | 'huy'
  kho_nguon text not null default 'Kho cắt lẻ',
  kho_dich text not null default 'Kho thành phẩm',
  kho_tai_che text not null default 'Kho tái chế',
  -- Nhiều SP: san_pham_nguon, san_pham_cat_1, san_pham_cat_2
  san_pham jsonb not null default '[]'::jsonb,
  ma_phieu_xuat text,
  ma_phieu_nhap_tp text,
  ma_phieu_nhap_thua text,
  ma_phieu_chuyen_tai_che text,
  ma_phieu_xuat_tai_che text,
  ma_phieu_nhap_tai_che text,
  nguoi_thuc_hien text,
  nguoi_lap text,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- unique ma_lenh (không chặn khi đã có index trùng tên)
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'lenh_cat_le_ma_lenh_key') then
    alter table public.lenh_cat_le add constraint lenh_cat_le_ma_lenh_key unique (ma_lenh);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists lenh_cat_le_ngay_cat_idx on public.lenh_cat_le (ngay_cat desc);
create index if not exists lenh_cat_le_trang_thai_idx on public.lenh_cat_le (trang_thai);

create or replace function public.set_lenh_cat_le_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lenh_cat_le_updated_at on public.lenh_cat_le;
create trigger trg_lenh_cat_le_updated_at
before update on public.lenh_cat_le
for each row execute function public.set_lenh_cat_le_updated_at();

alter table public.lenh_cat_le enable row level security;

drop policy if exists "lenh_cat_le_select_all" on public.lenh_cat_le;
create policy "lenh_cat_le_select_all" on public.lenh_cat_le for select using (true);
drop policy if exists "lenh_cat_le_insert_all" on public.lenh_cat_le;
create policy "lenh_cat_le_insert_all" on public.lenh_cat_le for insert with check (true);
drop policy if exists "lenh_cat_le_update_all" on public.lenh_cat_le;
create policy "lenh_cat_le_update_all" on public.lenh_cat_le for update using (true) with check (true);
drop policy if exists "lenh_cat_le_delete_all" on public.lenh_cat_le;
create policy "lenh_cat_le_delete_all" on public.lenh_cat_le for delete using (true);

grant select, insert, update, delete on public.lenh_cat_le to anon, authenticated, service_role;

-- Seed 2 kho vật lý dùng cho luồng cắt lẻ (không trùng thì thôi).
insert into public.quan_ly_kho (ten_kho)
select v.ten_kho from (values ('Kho cắt lẻ'), ('Kho tái chế')) as v(ten_kho)
where not exists (select 1 from public.quan_ly_kho q where lower(btrim(q.ten_kho)) = lower(btrim(v.ten_kho)));

select 'OK - bảng lenh_cat_le + 2 kho cắt lẻ/tái chế.' as result;
