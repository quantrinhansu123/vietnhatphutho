-- Chi phí kèm theo từng dòng phiếu tổng hợp.
-- Nguồn chính vẫn là phieu_nhap_xuat_tong_hop.chi_tiet[].chi_phi_kem_theo.
-- Chỉ mirror sang hai bảng vế mới. Không đụng phieu_xuat_nhap_kho.
alter table public.phieu_nhap_kho
  add column if not exists chi_phi_kem_theo jsonb not null default '[]'::jsonb;

alter table public.phieu_xuat_kho
  add column if not exists chi_phi_kem_theo jsonb not null default '[]'::jsonb;
