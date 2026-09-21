-- So che do may thang (MÁY ĐẶC) - chi nhanh Phu Tho
-- 1 so = 1 may + 1 thang + 1 nam, gom 8 khu vuc x 3 ca x 31 ngay + ban giao + ghi chu
create extension if not exists pgcrypto;

create table if not exists public.so_che_do_may (
  id uuid primary key default gen_random_uuid(),
  chi_nhanh text not null default 'Phú Thọ',
  ma_may text not null default '',
  ten_may text not null default '',
  thang integer not null,
  nam integer not null,
  o_che_do jsonb not null default '{}'::jsonb,
  ban_giao jsonb not null default '{}'::jsonb,
  ghi_chu jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_so_che_do_may_thang check (thang between 1 and 12),
  constraint chk_so_che_do_may_nam check (nam between 1 and 2999)
);

-- Chong trung: 1 may + 1 thang + 1 nam chi 1 so (ma_may = '' la so chung Tat ca may)
create unique index if not exists idx_so_che_do_may_unique_may_thang_nam
  on public.so_che_do_may (ma_may, thang, nam);

create index if not exists idx_so_che_do_may_nam_thang
  on public.so_che_do_may (nam desc, thang desc);

create or replace function public.set_so_che_do_may_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_so_che_do_may_updated_at on public.so_che_do_may;

create trigger trg_so_che_do_may_updated_at
before update on public.so_che_do_may
for each row
execute function public.set_so_che_do_may_updated_at();

comment on table public.so_che_do_may is 'So che do may thang (Phu Tho): 1 may + 1 thang + 1 nam, 8 khu vuc x 3 ca.';
comment on column public.so_che_do_may.ma_may is 'Ma may (danh_sach_may); rong = so chung Tat ca may';
comment on column public.so_che_do_may.o_che_do is 'Map o che do: {"<khuVuc>_<ca>_<ngay>": "v"|"x"}';
comment on column public.so_che_do_may.ban_giao is 'Ban giao theo ngay: {"<ngay>": {"ban_giao": "Ho ten", "nhan": "Ho ten"}}';
comment on column public.so_che_do_may.ghi_chu is 'Ghi chu gop o: [{id, tu_ngay: YYYY-MM-DD, den_ngay: YYYY-MM-DD, may: [ma_may], noi_dung}] (may rong = tat ca may)';
