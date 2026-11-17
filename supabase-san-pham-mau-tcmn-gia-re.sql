-- Schema san_pham theo master Đặc/Rỗng.
-- Thêm: mau, tcmn, gia_re.
-- Xóa cột thừa. Giữ ma_amis_cu, mo_ta. Không tạo np/off (gộp qua hang_phe).
-- File duy nhất — thay cho supabase-san-pham-mau-np-tcmn.sql.

alter table public.san_pham
  add column if not exists mau text,
  add column if not exists tcmn text,
  add column if not exists gia_re text,
  drop column if exists ten_ghep,
  drop column if exists ma_sp_moi,
  drop column if exists np,
  drop column if exists off,
  drop column if exists sl_ton,
  drop column if exists ton_kho,
  drop column if exists nhap_trong_ky,
  drop column if exists xuat_trong_ky,
  drop column if exists tong_trong_luong,
  drop column if exists kho_cuon,
  drop column if exists chieu_dai_cuon,
  drop column if exists trong_luong_loi,
  drop column if exists trong_luong_tui,
  drop column if exists trong_luong_nhua,
  drop column if exists ten_kho,
  drop column if exists tinh_chat,
  drop column if exists nguon_goc,
  drop column if exists ten_may_san_xuat,
  drop column if exists npl_phan_tram;
