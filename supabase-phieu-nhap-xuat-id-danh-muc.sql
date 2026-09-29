-- Id danh mục trên từng dòng phiếu nhập / xuất.
-- id_danh_muc trỏ kho_nvl, thành phẩm, hoặc sổ khác. loai_danh_muc ghi bảng nguồn.
-- Đợt này backfill loai_danh_muc = 'kho_nvl' cho phiếu NVL còn khớp dòng kho_nvl đang sống.
-- Chạy MỘT LẦN trong Supabase SQL Editor khi các dòng kho_nvl hiện tại vẫn còn.
-- Chạy lại sau khi đã xóa rồi tạo lại danh mục sẽ gắn phiếu cũ vào dòng mới.

alter table public.phieu_nhap_kho add column if not exists id_danh_muc uuid;
alter table public.phieu_nhap_kho add column if not exists loai_danh_muc text;

alter table public.phieu_xuat_kho add column if not exists id_danh_muc uuid;
alter table public.phieu_xuat_kho add column if not exists loai_danh_muc text;

do $$
begin
  if to_regclass('public.phieu_xuat_nhap_kho') is not null then
    alter table public.phieu_xuat_nhap_kho add column if not exists id_danh_muc uuid;
    alter table public.phieu_xuat_nhap_kho add column if not exists loai_danh_muc text;
  end if;
end $$;

create or replace function public._backfill_phieu_id_danh_muc(target_table text)
returns void
language plpgsql
as $$
begin
  if to_regclass('public.' || target_table) is null then
    return;
  end if;
  execute format($sql$
    update public.%I p
    set id_danh_muc = c.id,
        loai_danh_muc = 'kho_nvl'
    from (
      select distinct on (
        btrim(coalesce(ma_npl, '')),
        btrim(coalesce(ten_npl, '')),
        btrim(coalesce(ten_nvl_sx, '')),
        btrim(coalesce(ten_kho, ''))
      )
        id,
        btrim(coalesce(ma_npl, '')) as ma_npl,
        btrim(coalesce(ten_npl, '')) as ten_npl,
        btrim(coalesce(ten_nvl_sx, '')) as ten_nvl_sx,
        btrim(coalesce(ten_kho, '')) as ten_kho
      from public.kho_nvl
      where btrim(coalesce(ma_npl, '')) <> ''
      order by
        btrim(coalesce(ma_npl, '')),
        btrim(coalesce(ten_npl, '')),
        btrim(coalesce(ten_nvl_sx, '')),
        btrim(coalesce(ten_kho, '')),
        created_at desc nulls last
    ) c
    where p.id_danh_muc is null
      and btrim(coalesce(p.ma_npl, '')) <> ''
      and btrim(coalesce(p.ma_npl, '')) = c.ma_npl
      and btrim(coalesce(p.ten_npl, '')) = c.ten_npl
      and btrim(coalesce(p.ten_nvl_sx, '')) = c.ten_nvl_sx
      and btrim(coalesce(p.ten_kho, '')) = c.ten_kho
  $sql$, target_table);
end $$;

select public._backfill_phieu_id_danh_muc('phieu_nhap_kho');
select public._backfill_phieu_id_danh_muc('phieu_xuat_kho');
select public._backfill_phieu_id_danh_muc('phieu_xuat_nhap_kho');

drop function public._backfill_phieu_id_danh_muc(text);
