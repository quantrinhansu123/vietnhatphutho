-- Điều động nhân sự giữa các máy trong cùng 1 Lệnh sản xuất (Quản đốc)
-- Không ghi/sửa/xóa phan_cong_nhan_su gốc trong lenh_sx

create extension if not exists pgcrypto;

drop table if exists public.dieu_dong_nhan_su cascade;

create table if not exists public.dieu_dong_nhan_su (
  id uuid primary key default gen_random_uuid(),
  ngay_lam_viec date not null,
  ca text not null,
  ma_lenh_sx text not null,
  ma_nhan_su text not null,
  vai_tro text,
  may_goc text not null,
  may_dieu_dong text not null,
  thoi_gian_bat_dau time not null,
  thoi_gian_ket_thuc time not null,
  ghi_chu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dieu_dong_nhan_su_lookup
  on public.dieu_dong_nhan_su (ngay_lam_viec, ca, ma_lenh_sx);

create index if not exists idx_dieu_dong_nhan_su_personnel
  on public.dieu_dong_nhan_su (ma_nhan_su, ngay_lam_viec);

create or replace function public.set_dieu_dong_nhan_su_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dieu_dong_nhan_su_updated_at on public.dieu_dong_nhan_su;
create trigger trg_dieu_dong_nhan_su_updated_at
before update on public.dieu_dong_nhan_su
for each row execute function public.set_dieu_dong_nhan_su_updated_at();

alter table public.dieu_dong_nhan_su enable row level security;

drop policy if exists "dieu_dong_nhan_su_select_all" on public.dieu_dong_nhan_su;
create policy "dieu_dong_nhan_su_select_all" on public.dieu_dong_nhan_su for select using (true);

drop policy if exists "dieu_dong_nhan_su_insert_all" on public.dieu_dong_nhan_su;
create policy "dieu_dong_nhan_su_insert_all" on public.dieu_dong_nhan_su for insert with check (true);

drop policy if exists "dieu_dong_nhan_su_update_all" on public.dieu_dong_nhan_su;
create policy "dieu_dong_nhan_su_update_all" on public.dieu_dong_nhan_su for update using (true) with check (true);

drop policy if exists "dieu_dong_nhan_su_delete_all" on public.dieu_dong_nhan_su;
create policy "dieu_dong_nhan_su_delete_all" on public.dieu_dong_nhan_su for delete using (true);

comment on table public.dieu_dong_nhan_su is 'Ghi nhan dieu dong nhan su giua cac may trong cung 1 lenh_sx (Quan doc). Khong ghi/sua/xoa phan_cong_nhan_su goc trong lenh_sx.';
comment on column public.dieu_dong_nhan_su.ma_nhan_su is 'Trung voi AssignedPersonnel.personnelId trong lenh_sx.phan_cong_nhan_su (ma_nhan_su hoac ten).';
comment on column public.dieu_dong_nhan_su.ngay_lam_viec is 'Ngay lam viec (tu lenh_sx.ngay_bat_dau).';
comment on column public.dieu_dong_nhan_su.vai_tro is 'Snapshot vai tro tai thoi diem dieu dong (tu AssignedPersonnel.role).';
comment on column public.dieu_dong_nhan_su.may_goc is 'Snapshot vi_tri cua LSX tai thoi diem dieu dong.';
