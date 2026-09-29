drop index if exists public.kho_nvl_ma_npl_key;

create index if not exists kho_nvl_ma_npl_idx on public.kho_nvl (ma_npl);

create unique index if not exists kho_nvl_ma_ten_sx_key
  on public.kho_nvl (
    (btrim(coalesce(ma_npl, ''))),
    (btrim(coalesce(ten_npl, ''))),
    (btrim(coalesce(ten_nvl_sx, '')))
  );