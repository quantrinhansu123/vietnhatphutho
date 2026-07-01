-- Them loai bao cao dau ca / cuoi ca cho NVL ton theo may
alter table public.bao_cao_may_nvl_ton
  add column if not exists loai_bao_cao text not null default 'dau_ca';

create index if not exists idx_bao_cao_may_nvl_ton_loai
  on public.bao_cao_may_nvl_ton (loai_bao_cao);

comment on column public.bao_cao_may_nvl_ton.loai_bao_cao is 'Loai bao cao: dau_ca hoac cuoi_ca.';
