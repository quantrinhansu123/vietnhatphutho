-- Bổ sung lựa chọn Nhóm VTHH "Khác" cho bảng sản phẩm.
alter table public.san_pham
  drop constraint if exists san_pham_nhom_vthh_check;

alter table public.san_pham
  add constraint san_pham_nhom_vthh_check
  check (nhom_vthh in ('TP; PX Rỗng', 'TP; PX Đặc', 'TP; PX Sóng', 'TP; NVL', 'NVL', 'Khác'))
  not valid;
