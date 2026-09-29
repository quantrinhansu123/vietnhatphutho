-- nhap_kho.ten_san_xuat — tên sản xuất của dòng hàng.
-- Sổ nhap_kho là sổ tồn chung mọi loại hàng (sản phẩm, NVL...), phân biệt bằng loai_kho + ten_kho.
-- NVL: ten_san_xuat = tên NVL sản xuất (copy từ kho_nvl.ten_nvl_sx).
-- TP: để trống (tên ghép nằm ở ten_sp, thông số ở ten_goc/do_li/...).
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

alter table public.nhap_kho
  add column if not exists ten_san_xuat text;

create index if not exists nhap_kho_ten_san_xuat_idx on public.nhap_kho (ten_san_xuat);

comment on column public.nhap_kho.ten_san_xuat is 'Tên sản xuất của dòng hàng (NVL: tên NVL sản xuất; TP: để trống).';

-- Backfill từ kho_nvl cho các dòng NVL đã có (ma_sp = ma_npl).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kho_nvl' and column_name = 'ten_nvl_sx'
  ) then
    update public.nhap_kho as n
    set ten_san_xuat = k.ten_nvl_sx
    from public.kho_nvl as k
    where btrim(n.ma_sp) <> ''
      and btrim(n.ma_sp) = btrim(k.ma_npl)
      and (n.ten_san_xuat is null or btrim(n.ten_san_xuat) = '')
      and k.ten_nvl_sx is not null and btrim(k.ten_nvl_sx) <> '';
  end if;
end $$;

select 'OK - nhap_kho.ten_san_xuat.' as result;
