-- Lưu vết các lần thay đổi trọng lượng của phiếu trộn định mức.
-- Chạy trong Supabase SQL Editor; an toàn khi chạy lại.

alter table public.bang_tron_vat_tu_dinh_muc
  add column if not exists id_phieu_tron_dm_ban_dau uuid;

create index if not exists bang_tron_vat_tu_dinh_muc_ban_dau_idx
  on public.bang_tron_vat_tu_dinh_muc (id_phieu_tron_dm_ban_dau);

comment on column public.bang_tron_vat_tu_dinh_muc.id_phieu_tron_dm_ban_dau is
  'ID phieu tron dinh muc ban dau. Cac ban thay doi luon tro truc tiep ve ban dau, khong noi chuoi.';
