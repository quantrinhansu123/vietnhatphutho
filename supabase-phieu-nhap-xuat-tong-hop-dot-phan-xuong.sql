-- Gắn đợt SX + phân xưởng trên phiếu nhập/xuất tổng hợp (NVL đi sản xuất).
-- Chạy trong Supabase SQL Editor (idempotent).

alter table if exists public.phieu_nhap_xuat_tong_hop
  add column if not exists dot_san_xuat_id uuid,
  add column if not exists dot_so text,
  add column if not exists phan_xuong text,
  add column if not exists phieu_xuat_goc_id uuid,
  add column if not exists phieu_xuat_goc_ma text;

create index if not exists phieu_nhap_xuat_tong_hop_dot_san_xuat_id_idx
  on public.phieu_nhap_xuat_tong_hop (dot_san_xuat_id);

create index if not exists phieu_nhap_xuat_tong_hop_phan_xuong_idx
  on public.phieu_nhap_xuat_tong_hop (phan_xuong);

create index if not exists phieu_nhap_xuat_tong_hop_phieu_xuat_goc_id_idx
  on public.phieu_nhap_xuat_tong_hop (phieu_xuat_goc_id);

comment on column public.phieu_nhap_xuat_tong_hop.dot_san_xuat_id is
  'Cột cũ (FK mềm tới dot_san_xuat) — UI hiện lưu đợt cố định ở dot_so, có thể để null.';
comment on column public.phieu_nhap_xuat_tong_hop.dot_so is
  'Đợt SX cố định: "1"…"10" (hiển thị Đợt 1…Đợt 10).';
comment on column public.phieu_nhap_xuat_tong_hop.phan_xuong is
  'Phân xưởng lọc máy: Đặc | Sóng | Rỗng (vẫn phải chọn máy trên phiếu).';
comment on column public.phieu_nhap_xuat_tong_hop.phieu_xuat_goc_id is
  'Phiếu xuất tổng hợp gốc khi nhập lại giữa/cuối đợt.';
comment on column public.phieu_nhap_xuat_tong_hop.phieu_xuat_goc_ma is
  'Mã phiếu xuất gốc (snapshot).';
