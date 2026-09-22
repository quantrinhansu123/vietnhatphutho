-- Module 1: Phieu nhap / xuat NVL (chot spec 22/09/2026)
-- Chay trong Supabase SQL Editor. Idempotent: chay lai nhieu lan an toan.
-- Quy uoc da chot:
--   1) SL thuc nhap tay; Ton cuoi = Ton dau + Nhap - SL thuc (tinh tren UI, khong can cot DB).
--   2) ten_nvl_sx SNAPSHOT vao phieu (chong doi ten danh muc lam sai phieu cu).
--   3) Phieu nhap KHONG can May (may nullable); phieu xuat May bat buoc.
--   4) Phieu xuat: 1 ngay + N ca (chi cac ca cung loai_ca). Luu ca_list + ca chinh (ca dau tien).
--   5) Bao cao Kho NVL: Ton dau ky hard 0, chi tinh phieu (khong cong kho_nvl.ton_dau_ky).

alter table public.phieu_xuat_nhap_kho
  add column if not exists dia_diem text,
  add column if not exists loai_nhap_kho text,
  add column if not exists ten_nvl_sx text,
  add column if not exists ca_list text[];

comment on column public.phieu_xuat_nhap_kho.dia_diem is 'Dia diem giao/nhan hang tren phieu (tu nhap).';
comment on column public.phieu_xuat_nhap_kho.loai_nhap_kho is 'Loai nhap kho NVL: NVL mua ngoai | Phe mua ngoai | Nhap kho tao hat | Nhap lai vat tu SX | tu nhap tu do. Chi dung cho loai_phieu=nhap.';
comment on column public.phieu_xuat_nhap_kho.ten_nvl_sx is 'Ten NVL san xuat SNAPSHOT tai thoi diem lap phieu (chong doi ten danh muc). Phieu cu thieu thi tra live kho_nvl.';
comment on column public.phieu_xuat_nhap_kho.ca_list is 'Danh sach ca cua phieu xuat NVL (1 ngay + N ca cung loai_ca). Cot ca giu ca dau tien de tuong thich so tron / ton kho cu.';

create index if not exists phieu_xuat_nhap_kho_loai_nhap_idx
  on public.phieu_xuat_nhap_kho (loai_nhap_kho);
create index if not exists phieu_xuat_nhap_kho_ten_nvl_sx_idx
  on public.phieu_xuat_nhap_kho (ten_nvl_sx);
