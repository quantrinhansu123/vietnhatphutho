-- Migration (chi chay neu da tao bang so_che_do_may tu ban truoc): them may + doi unique
alter table if exists public.so_che_do_may
  add column if not exists ma_may text not null default '';

alter table if exists public.so_che_do_may
  add column if not exists ten_may text not null default '';

drop index if exists public.idx_so_che_do_may_unique_thang_nam;

-- Chong trung: 1 may + 1 thang + 1 nam chi 1 so (ma_may = '' la so chung Tat ca may)
create unique index if not exists idx_so_che_do_may_unique_may_thang_nam
  on public.so_che_do_may (ma_may, thang, nam);

comment on column public.so_che_do_may.ma_may is 'Ma may (danh_sach_may); rong = so chung Tat ca may';
comment on column public.so_che_do_may.ghi_chu is 'Ghi chu gop o: [{id, tu_ngay: YYYY-MM-DD, den_ngay: YYYY-MM-DD, may: [ma_may], noi_dung}] (may rong = tat ca may)';
