-- Run this file once in Supabase SQL Editor before using Excel replacement.
-- It replaces the complete customer list in one transaction.
-- If any statement fails, PostgreSQL rolls back and retains the previous data.

create or replace function public.replace_khach_hang_from_json(p_customers jsonb)
returns integer
language plpgsql
as $$
declare
  inserted_total integer;
begin
  if jsonb_typeof(p_customers) <> 'array' or jsonb_array_length(p_customers) = 0 then
    raise exception 'Customer list must contain at least one row.';
  end if;

  delete from public.khach_hang
  where ma_khach_hang is not null or ma_khach_hang is null;

  insert into public.khach_hang (
    ma_khach_hang,
    ten_khach_hang,
    dia_chi,
    dia_chi_moi,
    cong_no,
    ma_so_thue,
    dien_thoai,
    dt_di_dong_nlh,
    la_doi_tuong_noi_bo,
    don_vi_quan_ly,
    ghi_chu
  )
  select
    nullif(btrim(customer.value ->> 'ma_khach_hang'), ''),
    nullif(btrim(customer.value ->> 'ten_khach_hang'), ''),
    nullif(btrim(customer.value ->> 'dia_chi'), ''),
    nullif(btrim(customer.value ->> 'dia_chi_moi'), ''),
    coalesce(nullif(customer.value ->> 'cong_no', '')::numeric, 0),
    nullif(btrim(customer.value ->> 'ma_so_thue'), ''),
    nullif(btrim(customer.value ->> 'dien_thoai'), ''),
    nullif(btrim(customer.value ->> 'dt_di_dong_nlh'), ''),
    coalesce((customer.value ->> 'la_doi_tuong_noi_bo')::boolean, false),
    nullif(btrim(customer.value ->> 'don_vi_quan_ly'), ''),
    nullif(btrim(customer.value ->> 'ghi_chu'), '')
  from jsonb_array_elements(p_customers) as customer(value);

  get diagnostics inserted_total = row_count;
  return inserted_total;
end;
$$;

notify pgrst, 'reload schema';
