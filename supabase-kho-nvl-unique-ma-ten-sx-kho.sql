-- Unique kho_nvl = mã + tên + tên sản xuất + kho.
-- Cùng một NVL được nằm ở Kho NVL Chính và Kho PC như hai dòng.
-- Chạy sau supabase-kho-nvl-unique-ma-ten-sx.sql.

drop index if exists public.kho_nvl_ma_ten_sx_key;

delete from public.kho_nvl a
using public.kho_nvl b
where a.ctid < b.ctid
  and btrim(coalesce(a.ma_npl, '')) = btrim(coalesce(b.ma_npl, ''))
  and btrim(coalesce(a.ten_npl, '')) = btrim(coalesce(b.ten_npl, ''))
  and btrim(coalesce(a.ten_nvl_sx, '')) = btrim(coalesce(b.ten_nvl_sx, ''))
  and btrim(coalesce(a.ten_kho, '')) = btrim(coalesce(b.ten_kho, ''));

create unique index if not exists kho_nvl_ma_ten_sx_kho_key
  on public.kho_nvl (
    (btrim(coalesce(ma_npl, ''))),
    (btrim(coalesce(ten_npl, ''))),
    (btrim(coalesce(ten_nvl_sx, ''))),
    (btrim(coalesce(ten_kho, '')))
  );
