-- Chạy riêng trong Supabase SQL Editor để gỡ unique constraint trên ma_sp
-- Cho phép nhiều sản phẩm cùng Mã SP (có tên khác nhau hoặc tên sản xuất khác nhau)
-- Logic import sẽ kiểm tra trùng khớp cả 3 trường: Mã SP + Tên SP + Tên sản xuất

do $$
declare
  r record;
begin
  -- Gỡ constraint unique trên ma_sp nếu tồn tại dạng constraint
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'san_pham'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%ma_sp%'
  loop
    execute format('alter table public.san_pham drop constraint if exists %I', r.conname);
  end loop;

  -- Gỡ unique index trên ma_sp (san_pham_ma_sp_key được tạo bằng create unique index, không phải constraint)
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
      and pg_get_indexdef(x.indexrelid) ilike '%ma_sp%'
  loop
    execute format('drop index if exists public.%I', r.index_name);
  end loop;
end $$;

-- Tạo index thường (non-unique) trên ma_sp để tối ưu tìm kiếm
create index if not exists san_pham_ma_sp_idx on public.san_pham (ma_sp);

-- Xác nhận
select 'OK - Đã gỡ unique constraint/index trên ma_sp. Giờ có thể import nhiều sản phẩm cùng Mã SP nếu Tên SP hoặc Tên sản xuất khác.' as result;
