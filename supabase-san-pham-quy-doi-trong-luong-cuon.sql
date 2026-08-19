-- Bổ sung trọng lượng theo cuộn cho bảng quy đổi sản phẩm đang tồn tại.
alter table public.san_pham_quy_doi
  add column if not exists trong_luong_kg_cuon numeric;

comment on column public.san_pham_quy_doi.trong_luong_kg_cuon is
  'Trọng lượng của một cuộn, đơn vị kg/Cuộn.';
