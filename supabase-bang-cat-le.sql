-- Bảng cắt lẻ: 1 dòng cho mỗi miếng nguồn / cắt / còn lại khi Duyệt lệnh cắt lẻ.
-- Báo cáo + Theo dõi cắt lẻ đọc từ bảng này (không bóc JSON lenh_cat_le).
-- Cặp ma_amis (mã mới) <-> ma_amis_cu (mã cũ) để tính nhập/xuất theo mã cũ.
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

create extension if not exists pgcrypto;

create table if not exists public.bang_cat_le (
  id uuid primary key default gen_random_uuid(),
  ma_lenh text not null,
  -- 'nguon' | 'cat_1' | 'cat_2' | 'cat_3'
  loai text not null default 'cat_1',
  ma_amis text not null,
  ma_amis_cu text,
  ten_sp text,
  ten_san_xuat text,
  ngay date not null,
  kho text,
  so_luong numeric,
  don_vi text,
  nhom_vthh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- unique (ma_lenh, loai, ma_amis): duyệt lại / chạy lại không trùng dòng
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'bang_cat_le_lenh_loai_ma_key') then
    alter table public.bang_cat_le add constraint bang_cat_le_lenh_loai_ma_key unique (ma_lenh, loai, ma_amis);
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists bang_cat_le_ma_amis_idx on public.bang_cat_le (ma_amis);
create index if not exists bang_cat_le_ma_amis_cu_idx on public.bang_cat_le (ma_amis_cu);
create index if not exists bang_cat_le_ngay_idx on public.bang_cat_le (ngay desc);
create index if not exists bang_cat_le_ma_lenh_idx on public.bang_cat_le (ma_lenh);

create or replace function public.set_bang_cat_le_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bang_cat_le_updated_at on public.bang_cat_le;
create trigger trg_bang_cat_le_updated_at
before update on public.bang_cat_le
for each row execute function public.set_bang_cat_le_updated_at();

alter table public.bang_cat_le enable row level security;

drop policy if exists "bang_cat_le_select_all" on public.bang_cat_le;
create policy "bang_cat_le_select_all" on public.bang_cat_le for select using (true);
drop policy if exists "bang_cat_le_insert_all" on public.bang_cat_le;
create policy "bang_cat_le_insert_all" on public.bang_cat_le for insert with check (true);
drop policy if exists "bang_cat_le_update_all" on public.bang_cat_le;
create policy "bang_cat_le_update_all" on public.bang_cat_le for update using (true) with check (true);
drop policy if exists "bang_cat_le_delete_all" on public.bang_cat_le;
create policy "bang_cat_le_delete_all" on public.bang_cat_le for delete using (true);

grant select, insert, update, delete on public.bang_cat_le to anon, authenticated, service_role;

-- Seed các kho cắt lẻ theo nhóm VTHH (Đặc/Sóng/Rỗng đi kho riêng, không lộn kho).
-- Có rồi thì thôi. Chạy xong các kho hiện trong màn Kho hàng.
insert into public.quan_ly_kho (ten_kho)
select v.ten_kho from (values ('Kho Đặc'), ('Kho Sóng'), ('Kho Rỗng')) as v(ten_kho)
where not exists (select 1 from public.quan_ly_kho q where lower(btrim(q.ten_kho)) = lower(btrim(v.ten_kho)));

select 'OK - bang bang_cat_le + kho Dac/Song/Rong.' as result;
