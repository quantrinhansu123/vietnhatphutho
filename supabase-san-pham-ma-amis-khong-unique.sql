-- Chay rieng trong Supabase SQL Editor neu import Excel bi loi trung ma AMIS.
-- Cho phep nhieu san pham cung ma_amis; unique van giu o ma_sp.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'san_pham'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%ma_amis%'
  loop
    execute format('alter table public.san_pham drop constraint if exists %I', r.conname);
  end loop;

  for r in
    select i.relname as index_name
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'san_pham'
      and x.indisunique
      and not x.indisprimary
      and pg_get_indexdef(x.indexrelid) ilike '%ma_amis%'
  loop
    execute format('drop index if exists public.%I', r.index_name);
  end loop;
end $$;

create index if not exists san_pham_ma_amis_idx on public.san_pham (ma_amis);
