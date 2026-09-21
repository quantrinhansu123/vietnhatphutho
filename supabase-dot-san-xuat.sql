-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Bảng gom lệnh sản xuất + phiếu xuất NVL theo đợt (máy + khoảng ngày)
-- Phục vụ báo cáo "KẾT QUẢ ĐỊNH GIÁ VẬT TƯ - NHÂN CÔNG THỰC TẾ SẢN XUẤT ĐỢT X THÁNG Y/YYYY"

create extension if not exists pgcrypto;

create table if not exists public.dot_san_xuat (
  id uuid primary key default gen_random_uuid(),
  ten_dot text not null,
  dot_so integer not null default 1,
  thang integer not null,
  nam integer not null,
  tu_ngay date not null,
  den_ngay date not null,
  ma_may text not null default '',
  ten_may text not null default '',
  lenh_sx_ids jsonb not null default '[]'::jsonb,
  lenh_sx_snapshot jsonb not null default '[]'::jsonb,
  phieu_xuat_codes jsonb not null default '[]'::jsonb,
  -- Tổng tự động từ phiếu xuất kho NVL (loai_phieu=xuat, loai_kho=nvl, khớp máy + khoảng ngày)
  tong_tl_nvl_chinh numeric(14,3) not null default 0,
  tong_tien_nvl_chinh numeric(16,0) not null default 0,
  tong_tl_nvl_phu numeric(14,3) not null default 0,
  tong_tien_nvl_phu numeric(16,0) not null default 0,
  -- Nhập tay: các khoản không suy luận được (đối chiếu ảnh báo cáo đợt)
  thu_hoi_phe_tl numeric(14,3) not null default 0,
  thu_hoi_phe_tien numeric(16,0) not null default 0,
  hao_hut_kg numeric(14,3) not null default 0,
  tl_chinh_thuc_te_override numeric(14,3),
  gia_vt_tt_hao_hut numeric(14,2),
  chenh_lech_hao_hut numeric(14,2),
  ti_le_hao_hut numeric(8,4),
  -- Nhân công thực tế (nhập tay, bảng 2 trong ảnh)
  so_cong_truc numeric(10,2) not null default 0,
  so_cong_dau_may numeric(10,2) not null default 0,
  so_cong_cuoi_may numeric(10,2) not null default 0,
  tong_chi_phi_nhan_cong numeric(16,0) not null default 0,
  ghi_chu text not null default '',
  nguoi_lap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dot_san_xuat
  add column if not exists ten_dot text,
  add column if not exists dot_so integer,
  add column if not exists thang integer,
  add column if not exists nam integer,
  add column if not exists tu_ngay date,
  add column if not exists den_ngay date,
  add column if not exists ma_may text,
  add column if not exists ten_may text,
  add column if not exists lenh_sx_ids jsonb,
  add column if not exists lenh_sx_snapshot jsonb,
  add column if not exists phieu_xuat_codes jsonb,
  add column if not exists tong_tl_nvl_chinh numeric(14,3),
  add column if not exists tong_tien_nvl_chinh numeric(16,0),
  add column if not exists tong_tl_nvl_phu numeric(14,3),
  add column if not exists tong_tien_nvl_phu numeric(16,0),
  add column if not exists thu_hoi_phe_tl numeric(14,3),
  add column if not exists thu_hoi_phe_tien numeric(16,0),
  add column if not exists hao_hut_kg numeric(14,3),
  add column if not exists tl_chinh_thuc_te_override numeric(14,3),
  add column if not exists gia_vt_tt_hao_hut numeric(14,2),
  add column if not exists chenh_lech_hao_hut numeric(14,2),
  add column if not exists ti_le_hao_hut numeric(8,4),
  add column if not exists so_cong_truc numeric(10,2),
  add column if not exists so_cong_dau_may numeric(10,2),
  add column if not exists so_cong_cuoi_may numeric(10,2),
  add column if not exists tong_chi_phi_nhan_cong numeric(16,0),
  add column if not exists ghi_chu text,
  add column if not exists nguoi_lap text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Đổi tên cột sang tiếng Việt (an toàn khi chạy lại: chỉ đổi nếu cột cũ còn tồn tại)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='dot_san_xuat'
               and column_name='don_gia_tong_override') then
    alter table public.dot_san_xuat rename column don_gia_tong_override to gia_vt_tt_hao_hut;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='dot_san_xuat'
               and column_name='chenh_lech_override') then
    alter table public.dot_san_xuat rename column chenh_lech_override to chenh_lech_hao_hut;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='dot_san_xuat'
               and column_name='ti_le_override') then
    alter table public.dot_san_xuat rename column ti_le_override to ti_le_hao_hut;
  end if;
end $$;

create unique index if not exists dot_san_xuat_unique_dot
  on public.dot_san_xuat (nam, thang, dot_so, ma_may);
create index if not exists dot_san_xuat_ngay_idx
  on public.dot_san_xuat (tu_ngay desc, den_ngay desc);
create index if not exists dot_san_xuat_may_idx
  on public.dot_san_xuat (ma_may);

create or replace function public.set_dot_san_xuat_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dot_san_xuat_updated_at on public.dot_san_xuat;
create trigger trg_dot_san_xuat_updated_at
before update on public.dot_san_xuat
for each row execute function public.set_dot_san_xuat_updated_at();

alter table public.dot_san_xuat enable row level security;
drop policy if exists "dot_san_xuat_select_all" on public.dot_san_xuat;
create policy "dot_san_xuat_select_all" on public.dot_san_xuat for select using (true);
drop policy if exists "dot_san_xuat_insert_all" on public.dot_san_xuat;
create policy "dot_san_xuat_insert_all" on public.dot_san_xuat for insert with check (true);
drop policy if exists "dot_san_xuat_update_all" on public.dot_san_xuat;
create policy "dot_san_xuat_update_all" on public.dot_san_xuat for update using (true) with check (true);
drop policy if exists "dot_san_xuat_delete_all" on public.dot_san_xuat;
create policy "dot_san_xuat_delete_all" on public.dot_san_xuat for delete using (true);

comment on table public.dot_san_xuat is 'Đợt sản xuất: gom lệnh SX + phiếu xuất NVL theo máy và khoảng ngày, lưu tổng TL/tiền NVL chính-phụ.';
comment on column public.dot_san_xuat.ten_dot is 'Tên đợt, vd Đợt 4 tháng 8/2026. Tự gen Đợt 1,2,3,4 theo tháng+năm+máy.';
comment on column public.dot_san_xuat.lenh_sx_snapshot is 'Snapshot lệnh SX đã tick: [{id, ma_lenh_sx, ngay_bat_dau, may, san_pham}].';
comment on column public.dot_san_xuat.phieu_xuat_codes is 'Mã phiếu xuất NVL đã truy xuất trong khoảng ngày+máy.';
comment on column public.dot_san_xuat.tong_tl_nvl_chinh is 'Tổng trọng lượng NVL chính (kg) cộng từ trong_luong_kg các dòng phiếu xuất.';
comment on column public.dot_san_xuat.tong_tien_nvl_chinh is 'Tổng tiền NVL chính (VND) cộng từ thanh_tien các dòng phiếu xuất.';
comment on column public.dot_san_xuat.thu_hoi_phe_tl is 'Nhập tay: TL vật tư thu hồi cho phế bắt buộc & phế sản xuất.';
comment on column public.dot_san_xuat.hao_hut_kg is 'Nhập tay: hao hụt (kg).';
