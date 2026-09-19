-- Báo cáo hàng lỗi hỏng phát sinh ở khách hàng (nhập ở Kinh doanh, thống kê ở QC)
-- Mỗi dòng = 1 phiếu phát sinh: Loại SP (Nhóm VTHH) + Nội dung + Khu vực + Phân loại hàng + Xử lý (text tự do)
-- Không dùng CHECK constraint: các trường text lưu tự do, validate ở app.
create extension if not exists pgcrypto;

create table if not exists public.bao_cao_hang_loi_khach_hang (
  id uuid primary key default gen_random_uuid(),
  ngay date not null,
  nhom_vthh text not null,
  noi_dung text not null,
  khu_vuc text not null default 'Bắc',
  phan_loai_hang text not null default 'Hàng tiêu chuẩn',
  xu_ly_cong_ty text not null default '0',
  xu_ly_khac text not null default '0',
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nếu bảng đã tạo từ bản cũ (cột xu_ly_* integer + CHECK constraint), chạy khối này để đồng bộ:
-- alter table public.bao_cao_hang_loi_khach_hang alter column xu_ly_cong_ty type text using xu_ly_cong_ty::text;
-- alter table public.bao_cao_hang_loi_khach_hang alter column xu_ly_khac type text using xu_ly_khac::text;
-- alter table public.bao_cao_hang_loi_khach_hang drop constraint if exists bao_cao_hang_loi_khach_hang_nhom_vthh_check;
-- alter table public.bao_cao_hang_loi_khach_hang drop constraint if exists bao_cao_hang_loi_khach_hang_khu_vuc_check;
-- alter table public.bao_cao_hang_loi_khach_hang drop constraint if exists bao_cao_hang_loi_khach_hang_phan_loai_check;
-- alter table public.bao_cao_hang_loi_khach_hang drop constraint if exists bao_cao_hang_loi_khach_hang_xu_ly_cong_ty_check;
-- alter table public.bao_cao_hang_loi_khach_hang drop constraint if exists bao_cao_hang_loi_khach_hang_xu_ly_khac_check;

create index if not exists idx_hang_loi_kh_ngay
  on public.bao_cao_hang_loi_khach_hang (ngay desc);

create index if not exists idx_hang_loi_kh_nhom
  on public.bao_cao_hang_loi_khach_hang (nhom_vthh);

create or replace function public.set_bao_cao_hang_loi_khach_hang_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hang_loi_khach_hang_updated_at on public.bao_cao_hang_loi_khach_hang;

create trigger trg_hang_loi_khach_hang_updated_at
before update on public.bao_cao_hang_loi_khach_hang
for each row
execute function public.set_bao_cao_hang_loi_khach_hang_updated_at();

comment on table public.bao_cao_hang_loi_khach_hang is 'Báo cáo hàng lỗi hỏng phát sinh ở khách hàng: Kinh doanh nhập, QC thống kê theo Nhóm VTHH.';
comment on column public.bao_cao_hang_loi_khach_hang.nhom_vthh is 'Loại sản phẩm theo Nhóm VTHH (text tự do, thường: TP; PX Đặc, TP; PX Rỗng, TP; PX Sóng).';
comment on column public.bao_cao_hang_loi_khach_hang.khu_vuc is 'Khu vực phát sinh (text tự do, thường: Bắc/Trung/Nam; Bắc→MB, Trung/Nam→HCM&MT).';
comment on column public.bao_cao_hang_loi_khach_hang.phan_loai_hang is 'Phân loại hàng phế (text tự do, dùng chung WASTE_GRADE_OPTIONS với form sản phẩm).';
comment on column public.bao_cao_hang_loi_khach_hang.xu_ly_cong_ty is 'Xử lý của Công ty (text tự do).';
comment on column public.bao_cao_hang_loi_khach_hang.xu_ly_khac is 'Xử lý Khác (text tự do).';
