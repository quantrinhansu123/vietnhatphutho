-- Chay lai an toan trong Supabase SQL Editor (DB chinh).
-- Bo sung kho vat ly va hai RPC chi doc cho man hinh Ton kho.

alter table public.kho_nvl add column if not exists ten_kho text;
alter table public.san_pham add column if not exists ten_kho text;
alter table public.phieu_xuat_nhap_kho add column if not exists ten_kho text;

create index if not exists kho_nvl_ten_kho_idx on public.kho_nvl (ten_kho);
create index if not exists san_pham_ten_kho_idx on public.san_pham (ten_kho);
create index if not exists phieu_xuat_nhap_kho_ten_kho_idx on public.phieu_xuat_nhap_kho (ten_kho);

create or replace function public.ton_kho_nvl_gop(
  p_ten_kho text default null,
  p_tu_ngay date default null,
  p_den_ngay date default null
)
returns table (
  ma text,
  ten text,
  don_vi text,
  ten_kho text,
  ton_dau_ky numeric,
  nhap_trong_ky numeric,
  xuat_trong_ky numeric,
  ton_cuoi_ky numeric
)
language sql
stable
as $$
  with catalog as (
    select k.ma_npl as ma, k.ten_npl as ten, k.don_vi, k.ten_kho, coalesce(k.ton_dau_ky, 0) as baseline
    from public.kho_nvl k
    where p_ten_kho is null or k.ten_kho = p_ten_kho
  ),
  movement_codes as (
    select distinct m.ma_npl as ma
    from public.phieu_xuat_nhap_kho m
    where (m.loai_kho = 'nvl' or m.loai_kho is null)
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
      and m.ma_npl is not null and btrim(m.ma_npl) <> ''
  ),
  codes as (
    select ma from catalog
    union
    select ma from movement_codes
  ),
  opening_adj as (
    select m.ma_npl as ma,
      sum(case when m.loai_phieu = 'nhap' then coalesce(m.so_luong, 0)
               when m.loai_phieu = 'xuat' then -coalesce(m.so_luong, 0) else 0 end) as qty
    from public.phieu_xuat_nhap_kho m
    where p_tu_ngay is not null and m.ngay_phieu < p_tu_ngay
      and (m.loai_kho = 'nvl' or m.loai_kho is null)
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
    group by m.ma_npl
  ),
  period_totals as (
    select m.ma_npl as ma,
      sum(case when m.loai_phieu = 'nhap' then coalesce(m.so_luong, 0) else 0 end) as nhap,
      sum(case when m.loai_phieu = 'xuat' then coalesce(m.so_luong, 0) else 0 end) as xuat
    from public.phieu_xuat_nhap_kho m
    where (m.loai_kho = 'nvl' or m.loai_kho is null)
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
      and (p_tu_ngay is null or m.ngay_phieu >= p_tu_ngay)
      and (p_den_ngay is null or m.ngay_phieu <= p_den_ngay)
    group by m.ma_npl
  )
  select c.ma,
    coalesce(cat.ten, c.ma), cat.don_vi, cat.ten_kho,
    coalesce(cat.baseline, 0) + coalesce(oa.qty, 0) as ton_dau_ky,
    coalesce(pt.nhap, 0) as nhap_trong_ky,
    coalesce(pt.xuat, 0) as xuat_trong_ky,
    coalesce(cat.baseline, 0) + coalesce(oa.qty, 0) + coalesce(pt.nhap, 0) - coalesce(pt.xuat, 0) as ton_cuoi_ky
  from codes c
  left join catalog cat on cat.ma = c.ma
  left join opening_adj oa on oa.ma = c.ma
  left join period_totals pt on pt.ma = c.ma
  order by c.ma;
$$;

create or replace function public.ton_kho_san_pham_gop(
  p_ten_kho text default null,
  p_tu_ngay date default null,
  p_den_ngay date default null
)
returns table (
  ma text,
  ten text,
  don_vi text,
  ten_kho text,
  ton_dau_ky numeric,
  nhap_trong_ky numeric,
  xuat_trong_ky numeric,
  ton_cuoi_ky numeric
)
language sql
stable
as $$
  with catalog as (
    select p.ma_sp as ma, p.ten_sp as ten, p.don_vi, p.ten_kho, coalesce(p.ton_dau_ky, 0) as baseline
    from public.san_pham p
    where p_ten_kho is null or p.ten_kho = p_ten_kho
  ),
  movement_codes as (
    select distinct m.ma_sp as ma
    from public.phieu_xuat_nhap_kho m
    where m.loai_kho = 'san_pham'
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
      and m.ma_sp is not null and btrim(m.ma_sp) <> ''
  ),
  codes as (
    select ma from catalog
    union
    select ma from movement_codes
  ),
  opening_adj as (
    select m.ma_sp as ma,
      sum(case when m.loai_phieu = 'nhap' then coalesce(m.so_luong, 0)
               when m.loai_phieu = 'xuat' then -coalesce(m.so_luong, 0) else 0 end) as qty
    from public.phieu_xuat_nhap_kho m
    where p_tu_ngay is not null and m.ngay_phieu < p_tu_ngay
      and m.loai_kho = 'san_pham'
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
    group by m.ma_sp
  ),
  period_totals as (
    select m.ma_sp as ma,
      sum(case when m.loai_phieu = 'nhap' then coalesce(m.so_luong, 0) else 0 end) as nhap,
      sum(case when m.loai_phieu = 'xuat' then coalesce(m.so_luong, 0) else 0 end) as xuat
    from public.phieu_xuat_nhap_kho m
    where m.loai_kho = 'san_pham'
      and (p_ten_kho is null or m.ten_kho = p_ten_kho)
      and (p_tu_ngay is null or m.ngay_phieu >= p_tu_ngay)
      and (p_den_ngay is null or m.ngay_phieu <= p_den_ngay)
    group by m.ma_sp
  )
  select c.ma,
    coalesce(cat.ten, c.ma), cat.don_vi, cat.ten_kho,
    coalesce(cat.baseline, 0) + coalesce(oa.qty, 0) as ton_dau_ky,
    coalesce(pt.nhap, 0) as nhap_trong_ky,
    coalesce(pt.xuat, 0) as xuat_trong_ky,
    coalesce(cat.baseline, 0) + coalesce(oa.qty, 0) + coalesce(pt.nhap, 0) - coalesce(pt.xuat, 0) as ton_cuoi_ky
  from codes c
  left join catalog cat on cat.ma = c.ma
  left join opening_adj oa on oa.ma = c.ma
  left join period_totals pt on pt.ma = c.ma
  order by c.ma;
$$;

grant execute on function public.ton_kho_nvl_gop(text, date, date) to anon, authenticated, service_role;
grant execute on function public.ton_kho_san_pham_gop(text, date, date) to anon, authenticated, service_role;
