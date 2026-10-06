-- Giao ca note cho so_tron (hien thi o Phieu giao ca, anh 1)
-- Chay 1 lan trong Supabase SQL Editor. An toan khi chay lai.
alter table if exists public.so_tron
  add column if not exists giao_ca_note text not null default '';
comment on column public.so_tron.giao_ca_note is 'Giao ca (VD: 652 kg) — nguoi dung sua duoc, goi y mac dinh = tong ton cuoi ca.';
