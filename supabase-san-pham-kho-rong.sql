-- Rename the product width field from do_day_m to kho_rong.
-- Existing values are preserved. The old column is removed after migration.

alter table public.san_pham
  add column if not exists kho_rong text;

drop trigger if exists trg_sync_san_pham_kho_rong_compat on public.san_pham;
drop function if exists public.sync_san_pham_kho_rong_compat();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'san_pham' and column_name = 'do_day_m'
  ) then
    update public.san_pham
    set kho_rong = coalesce(kho_rong, do_day_m);

    alter table public.san_pham drop column do_day_m;
  end if;
end;
$$;

comment on column public.san_pham.kho_rong is 'Khổ rộng sản phẩm (m).';

select 'OK - Đã chuyển dữ liệu sang kho_rong và xóa cột do_day_m.' as result;
