-- Sổ test mẫu nhựa (QC) - 1 sổ = 1 ngày, nhiều dòng loại hàng (kho NVL chính + phụ)
-- Cột theo mẫu giấy: Ngày tháng | Loại Hàng | Chỉ số test (Máy Ép Mẫu, Máy Va Đập, Chỉ số MFI) | Kết Luận | Người Thực Hiện
create extension if not exists pgcrypto;

create table if not exists public.so_test_mau_nhua (
  id uuid primary key default gen_random_uuid(),
  chi_nhanh text not null default 'Phú Thọ',
  ngay date not null,
  chi_tiet jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chống trùng: 1 ngày chỉ 1 sổ
create unique index if not exists idx_so_test_mau_nhua_unique_ngay
  on public.so_test_mau_nhua (ngay);

create index if not exists idx_so_test_mau_nhua_ngay
  on public.so_test_mau_nhua (ngay desc);

create or replace function public.set_so_test_mau_nhua_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_so_test_mau_nhua_updated_at on public.so_test_mau_nhua;

create trigger trg_so_test_mau_nhua_updated_at
before update on public.so_test_mau_nhua
for each row
execute function public.set_so_test_mau_nhua_updated_at();

comment on table public.so_test_mau_nhua is 'Sổ test mẫu nhựa của QC (Phú Thọ): 1 ngày = 1 sổ, nhiều dòng loại hàng.';
comment on column public.so_test_mau_nhua.chi_tiet is 'Chi tiết test: [{material_id, ma_npl, ten_npl, may_ep_mau, may_va_dap, chi_so_mi, ket_luan, nguoi_thuc_hien}] - Loại Hàng chọn từ kho_nvl (NVL chính + NVL phụ).';
