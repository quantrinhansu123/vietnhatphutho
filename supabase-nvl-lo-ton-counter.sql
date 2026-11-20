-- Chay trong Supabase SQL Editor (idempotent). Chay tren DB test truoc.
-- Muc tieu: ton tung lo NVL duoc luu san + khoa dong, khong phai quet lai toan bo lich su xuat.
--
--  * so_luong_da_xuat : tong SL xuat da tru vao lo (trigger tu cap nhat khi them/sua/xoa dong xuat)
--  * so_luong_con     : cot sinh san = so_luong - so_luong_da_xuat (index duoc)
--  * Chong xuat vuot ton: UPDATE khoa dong lo => 2 phieu cung luc se xep hang, phieu sau bi tu choi.
--  * Ap dung cho ca bang tach (phieu_nhap_kho / phieu_xuat_kho) lan bang cu (phieu_xuat_nhap_kho).

-- 1. Cot dem tren cac bang co the chua dong nhap (lo)
do $$
declare t text;
begin
  foreach t in array array['phieu_nhap_kho', 'phieu_xuat_nhap_kho'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists so_luong_da_xuat numeric not null default 0', t);
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'so_luong_con'
      ) then
        execute format(
          'alter table public.%I add column so_luong_con numeric generated always as (coalesce(so_luong, 0) - coalesce(so_luong_da_xuat, 0)) stored',
          t
        );
      end if;
    end if;
  end loop;
end $$;

-- 2. Backfill tu lich su (dedupe theo id vi bang cu va bang moi co the trung id)
with xuat as (
  select distinct on (id) id, id_dong_nhap_nguon as lot_id, so_luong
  from (
    select id, id_dong_nhap_nguon, so_luong, 1 as pri from public.phieu_xuat_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
    union all
    select id, id_dong_nhap_nguon, so_luong, 2 as pri from public.phieu_xuat_nhap_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
  ) u
  where coalesce(so_luong, 0) > 0
  order by id, pri
),
sum_by_lot as (
  select lot_id, sum(so_luong) as da_xuat from xuat group by lot_id
)
update public.phieu_nhap_kho n
set so_luong_da_xuat = s.da_xuat
from sum_by_lot s
where n.id = s.lot_id and n.so_luong_da_xuat is distinct from s.da_xuat;

with xuat as (
  select distinct on (id) id, id_dong_nhap_nguon as lot_id, so_luong
  from (
    select id, id_dong_nhap_nguon, so_luong, 1 as pri from public.phieu_xuat_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
    union all
    select id, id_dong_nhap_nguon, so_luong, 2 as pri from public.phieu_xuat_nhap_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
  ) u
  where coalesce(so_luong, 0) > 0
  order by id, pri
),
sum_by_lot as (
  select lot_id, sum(so_luong) as da_xuat from xuat group by lot_id
)
update public.phieu_xuat_nhap_kho n
set so_luong_da_xuat = s.da_xuat
from sum_by_lot s
where n.id = s.lot_id and n.so_luong_da_xuat is distinct from s.da_xuat;

-- 3. Index: chi doc cac lo con ton
create index if not exists phieu_nhap_kho_lo_con_idx
  on public.phieu_nhap_kho (ma_npl, ngay_phieu, created_at)
  where loai_phieu = 'nhap' and so_luong_con > 0;

create index if not exists phieu_xuat_nhap_kho_lo_con_idx
  on public.phieu_xuat_nhap_kho (ma_npl, ngay_phieu, created_at)
  where loai_phieu = 'nhap' and so_luong_con > 0;

create index if not exists phieu_xuat_kho_ma_phieu_idx on public.phieu_xuat_kho (ma_phieu);

-- 4. Trigger tru/cong lui ton lo khi them / sua / xoa dong xuat
create or replace function public.trg_nvl_lo_ton_apply()
returns trigger
language plpgsql
as $$
declare
  old_lot uuid; new_lot uuid;
  old_qty numeric := 0; new_qty numeric := 0;
  delta numeric;
  consumed numeric; total numeric;
  hit int;
begin
  if tg_op in ('UPDATE', 'DELETE')
     and old.loai_phieu = 'xuat' and old.id_dong_nhap_nguon is not null and coalesce(old.so_luong, 0) > 0 then
    old_lot := old.id_dong_nhap_nguon; old_qty := old.so_luong;
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and new.loai_phieu = 'xuat' and new.id_dong_nhap_nguon is not null and coalesce(new.so_luong, 0) > 0 then
    new_lot := new.id_dong_nhap_nguon; new_qty := new.so_luong;
  end if;

  if old_lot is not null and old_lot is not distinct from new_lot then
    -- cung lo: chi ap dung chenh lech
    delta := new_qty - old_qty;
    if delta <> 0 then
      perform public.nvl_lo_ton_bump(old_lot, delta);
    end if;
  else
    if old_lot is not null then perform public.nvl_lo_ton_bump(old_lot, -old_qty); end if;
    if new_lot is not null then perform public.nvl_lo_ton_bump(new_lot, new_qty); end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Cong delta vao lo (bang moi hoac bang cu). Khi delta > 0 chan vuot ton (du lieu cu da vuot van sua/huy duoc).
create or replace function public.nvl_lo_ton_bump(p_lot uuid, p_delta numeric)
returns void
language plpgsql
as $$
declare
  hit int := 0;
  r record;
begin
  if to_regclass('public.phieu_nhap_kho') is not null then
    update public.phieu_nhap_kho
      set so_luong_da_xuat = greatest(0, coalesce(so_luong_da_xuat, 0) + p_delta)
      where id = p_lot
      returning so_luong, so_luong_da_xuat, ma_phieu, ma_npl into r;
    if found then
      hit := 1;
      if p_delta > 0 and r.so_luong_da_xuat > coalesce(r.so_luong, 0) + 0.0005 then
        raise exception 'Xuat vuot ton lo % (%): con %, yeu cau them %',
          r.ma_phieu, r.ma_npl, coalesce(r.so_luong, 0) - (r.so_luong_da_xuat - p_delta), p_delta
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  if to_regclass('public.phieu_xuat_nhap_kho') is not null then
    update public.phieu_xuat_nhap_kho
      set so_luong_da_xuat = greatest(0, coalesce(so_luong_da_xuat, 0) + p_delta)
      where id = p_lot
      returning so_luong, so_luong_da_xuat, ma_phieu, ma_npl into r;
    if found then
      hit := 1;
      if p_delta > 0 and r.so_luong_da_xuat > coalesce(r.so_luong, 0) + 0.0005 then
        raise exception 'Xuat vuot ton lo % (%): con %, yeu cau them %',
          r.ma_phieu, r.ma_npl, coalesce(r.so_luong, 0) - (r.so_luong_da_xuat - p_delta), p_delta
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['phieu_xuat_kho', 'phieu_xuat_nhap_kho'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_nvl_lo_ton on public.%I', t);
      execute format(
        'create trigger trg_nvl_lo_ton after insert or update or delete on public.%I
           for each row execute function public.trg_nvl_lo_ton_apply()', t);
    end if;
  end loop;
end $$;

-- 5. Doi soat: lo nao so_luong_da_xuat lech so voi tinh lai tu lich su (ket qua rong = khop)
create or replace view public.v_nvl_lo_ton_lech as
with xuat as (
  select distinct on (id) id, id_dong_nhap_nguon as lot_id, so_luong
  from (
    select id, id_dong_nhap_nguon, so_luong, 1 as pri from public.phieu_xuat_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
    union all
    select id, id_dong_nhap_nguon, so_luong, 2 as pri from public.phieu_xuat_nhap_kho
      where loai_phieu = 'xuat' and id_dong_nhap_nguon is not null
  ) u
  where coalesce(so_luong, 0) > 0
  order by id, pri
),
tinh_lai as (select lot_id, sum(so_luong) as da_xuat from xuat group by lot_id)
select n.id, n.ma_phieu, n.ma_npl, n.so_luong, n.so_luong_da_xuat as luu, coalesce(t.da_xuat, 0) as tinh_lai
from public.phieu_nhap_kho n
left join tinh_lai t on t.lot_id = n.id
where n.loai_phieu = 'nhap'
  and abs(n.so_luong_da_xuat - coalesce(t.da_xuat, 0)) > 0.0005;
