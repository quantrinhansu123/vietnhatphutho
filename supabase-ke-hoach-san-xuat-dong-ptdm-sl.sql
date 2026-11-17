-- KHSX dòng: gắn nhiều PTĐM + audit thời gian gắn.
-- SL kế hoạch / đã SX / SL lệnh lưu trong JSON san_pham:
--   so_luong, so_luong_lenh, so_luong_da_sx

alter table public.ke_hoach_san_xuat_dong
  add column if not exists danh_sach_ptdm jsonb not null default '[]'::jsonb;

comment on column public.ke_hoach_san_xuat_dong.danh_sach_ptdm is
  'Lich su PTDM gan vao dong KH: [{ dinh_muc_id, ten_phieu, thoi_gian_gan, so_luong_ap_dung_theo_sp: [{ san_pham_id, ma_sp, so_luong_ap_dung }] }]';
