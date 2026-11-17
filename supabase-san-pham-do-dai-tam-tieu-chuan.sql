-- Mét dài tấm tiêu chuẩn của định mức kg Sóng (vd /6M trong "ĐM 9.5KG/6M").
-- Không phải do_dai_m (mét dài SP đang cắt). Đặc/Rỗng để trống.

alter table public.san_pham
  add column if not exists do_dai_tam_tieu_chuan text;

comment on column public.san_pham.do_dai_tam_tieu_chuan is
  'Met dai tam tieu chuan cua dinh_muc_kg (Song), vd "6m" trong ĐM 9.5KG/6M. Khac do_dai_m.';
