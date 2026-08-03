-- Dong bo idempotent tu DB phieu can (kiem_kho) vao DB chinh (san_pham).
-- Chay file nay trong Supabase SQL Editor cua DB CHINH.

create table if not exists public.kiem_kho_dong_bo_ton_dau (
  kiem_kho_id text primary key,
  ma_sp text not null,
  so_luong numeric not null default 1,
  san_pham_id uuid not null references public.san_pham(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.kiem_kho_dong_bo_ton_dau enable row level security;

create or replace function public.dong_bo_kiem_kho_ton_dau(
  p_kiem_kho_id text,
  p_ma_sp text,
  p_so_luong numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_opening_stock numeric;
  v_inserted boolean := false;
begin
  if nullif(btrim(p_kiem_kho_id), '') is null then
    raise exception 'Thieu ID dong kiem kho.';
  end if;
  if nullif(btrim(p_ma_sp), '') is null then
    return jsonb_build_object('matched', false, 'applied', false);
  end if;
  if p_so_luong is null or p_so_luong <= 0 then
    raise exception 'So luong dong bo phai lon hon 0.';
  end if;

  select id
    into v_product_id
  from public.san_pham
  where lower(btrim(ma_sp)) = lower(btrim(p_ma_sp))
  order by created_at asc, id asc
  limit 1;

  if v_product_id is null then
    return jsonb_build_object('matched', false, 'applied', false);
  end if;

  insert into public.kiem_kho_dong_bo_ton_dau (kiem_kho_id, ma_sp, so_luong, san_pham_id)
  values (btrim(p_kiem_kho_id), btrim(p_ma_sp), p_so_luong, v_product_id)
  on conflict (kiem_kho_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    update public.san_pham
    set ton_dau_ky = coalesce(ton_dau_ky, 0) + p_so_luong
    where id = v_product_id
    returning ton_dau_ky into v_opening_stock;
  else
    select ton_dau_ky into v_opening_stock
    from public.san_pham
    where id = v_product_id;
  end if;

  return jsonb_build_object(
    'matched', true,
    'applied', coalesce(v_inserted, false),
    'product_id', v_product_id,
    'opening_stock', coalesce(v_opening_stock, 0)
  );
end;
$$;

revoke all on function public.dong_bo_kiem_kho_ton_dau(text, text, numeric) from public;
grant execute on function public.dong_bo_kiem_kho_ton_dau(text, text, numeric)
  to anon, authenticated, service_role;

comment on table public.kiem_kho_dong_bo_ton_dau is
  'So cai chong cong trung ton dau khi dong bo cac dong kiem_kho tu DB phieu can.';
comment on function public.dong_bo_kiem_kho_ton_dau(text, text, numeric) is
  'Cong ton_dau_ky dung mot lan cho moi kiem_kho_id.';
