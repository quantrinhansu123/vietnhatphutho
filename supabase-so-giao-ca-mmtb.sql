-- Biểu mẫu Sổ giao ca MMTB (Trưởng ca/Công nhân)
-- Bảng theo dõi chế độ chạy máy & chất lượng hàng ngày
create extension if not exists pgcrypto;

create table if not exists public.so_giao_ca_mmtb (
  id uuid primary key default gen_random_uuid(),
  chi_nhanh text not null default 'Phú Thọ',
  ngay date not null,
  ma_may text not null default '',
  ten_may text not null default '',
  ca text not null default '',
  ma_lenh_sx text not null default '',
  ten_san_pham text not null default '',
  quy_cach text not null default '',
  truong_ca text not null default '',
  nguoi_kiem_tra text not null default '',
  dong_tieu_chuan jsonb not null default '{}'::jsonb,
  bang_che_do_chay jsonb not null default '[]'::jsonb,
  bang_san_pham jsonb not null default '[]'::jsonb,
  ghi_chu_tieu_chuan_sp text not null default '',
  chu_ky jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chỉ mục tìm kiếm và chống trùng
create unique index if not exists idx_so_giao_ca_mmtb_unique
  on public.so_giao_ca_mmtb (ma_may, ngay, ca, ma_lenh_sx);

create index if not exists idx_so_giao_ca_mmtb_ngay
  on public.so_giao_ca_mmtb (ngay desc);

create index if not exists idx_so_giao_ca_mmtb_ma_may
  on public.so_giao_ca_mmtb (ma_may);

create index if not exists idx_so_giao_ca_mmtb_lenh
  on public.so_giao_ca_mmtb (ma_lenh_sx);

create or replace function public.set_so_giao_ca_mmtb_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_so_giao_ca_mmtb_updated_at on public.so_giao_ca_mmtb;

create trigger trg_so_giao_ca_mmtb_updated_at
before update on public.so_giao_ca_mmtb
for each row
execute function public.set_so_giao_ca_mmtb_updated_at();

comment on table public.so_giao_ca_mmtb is 'Sổ giao ca MMTB (Trưởng ca/Công nhân) — Bảng theo dõi chế độ chạy máy & chất lượng hàng ngày.';
comment on column public.so_giao_ca_mmtb.dong_tieu_chuan is 'Dòng tiêu chuẩn máy: toc_do_bom, toc_do_lo, thay_mang (9..17), khu_khuon (18..32), lo_ep_quang (tren, giua, duoi), ghi_chu.';
comment on column public.so_giao_ca_mmtb.bang_che_do_chay is 'Các dòng theo dõi đo nhiệt độ và chế độ chạy máy theo giờ.';
comment on column public.so_giao_ca_mmtb.bang_san_pham is 'Các dòng kiểm tra sản phẩm: giờ, màu sắc, độ dày, chiều rộng, chiều dài, trọng lượng, số seri, kết quả.';
