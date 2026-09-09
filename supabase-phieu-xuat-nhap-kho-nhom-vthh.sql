-- Lưu nhóm VTHH của dòng NVL từ phiếu trộn định mức sang phiếu xuất kho NVL
alter table public.phieu_xuat_nhap_kho
  add column if not exists nhom_vthh text;

comment on column public.phieu_xuat_nhap_kho.nhom_vthh is
  'Nhom VTHH cua dong NVL phu tu phieu tron dinh muc (TP; PX Rong, TP; PX Dac, TP; PX Song).';
