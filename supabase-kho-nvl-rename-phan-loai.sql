-- Chay mot lan tren database hien huu sau khi deploy code da ho tro `phan_loai`.
-- ALTER RENAME giu nguyen du lieu trong cot cu.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kho_nvl'
      and column_name = 'kho_ngam_dinh'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kho_nvl'
      and column_name = 'phan_loai'
  ) then
    alter table public.kho_nvl
      rename column kho_ngam_dinh to phan_loai;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kho_nvl'
      and column_name = 'kho_ngam_dinh'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kho_nvl'
      and column_name = 'phan_loai'
  ) then
    update public.kho_nvl
    set phan_loai = coalesce(nullif(phan_loai, ''), kho_ngam_dinh);
    alter table public.kho_nvl
      drop column kho_ngam_dinh;
  end if;
end $$;

comment on column public.kho_nvl.phan_loai is
  'Phan loai: Nguyen vat lieu phu hoac Nguyen vat lieu chinh.';
