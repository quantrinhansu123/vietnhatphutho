-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại).
-- Bảng Nhà cung cấp: phục vụ màn hình /nha-cung-cap.
-- Cột bám đúng yêu cầu: mã, tên, địa chỉ, số tiền nợ, MST/CCCD,
-- rủi ro hóa đơn, văn bản tham chiếu, điện thoại,
-- là đối tượng nội bộ, là tổng công ty/chi nhánh.

create table if not exists public.nha_cung_cap (
  id uuid not null default gen_random_uuid() primary key,
  ma_nha_cung_cap text not null unique,
  ten_nha_cung_cap text not null default '',
  dia_chi text,
  so_tien_no numeric(18,2) not null default 0,
  ma_so_thue_cccd text,
  rui_ro_hoa_don text,
  van_ban_tham_chieu text,
  dien_thoai text,
  la_doi_tuong_noi_bo boolean not null default false,
  la_tong_cong_ty_chi_nhanh boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nha_cung_cap
  add column if not exists ma_nha_cung_cap text,
  add column if not exists ten_nha_cung_cap text,
  add column if not exists dia_chi text,
  add column if not exists so_tien_no numeric(18,2),
  add column if not exists ma_so_thue_cccd text,
  add column if not exists rui_ro_hoa_don text,
  add column if not exists van_ban_tham_chieu text,
  add column if not exists dien_thoai text,
  add column if not exists la_doi_tuong_noi_bo boolean,
  add column if not exists la_tong_cong_ty_chi_nhanh boolean;

-- Chuẩn hóa NOT NULL + default cho dữ liệu cũ thiếu cột.
alter table public.nha_cung_cap
  alter column ma_nha_cung_cap set not null,
  alter column ten_nha_cung_cap set not null,
  alter column ten_nha_cung_cap set default '',
  alter column so_tien_no set not null,
  alter column so_tien_no set default 0,
  alter column la_doi_tuong_noi_bo set not null,
  alter column la_doi_tuong_noi_bo set default false,
  alter column la_tong_cong_ty_chi_nhanh set not null,
  alter column la_tong_cong_ty_chi_nhanh set default false;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'nha_cung_cap'
      and indexname = 'nha_cung_cap_ma_unique'
  ) then
    create unique index nha_cung_cap_ma_unique
      on public.nha_cung_cap (ma_nha_cung_cap);
  end if;
end $$;

create index if not exists nha_cung_cap_ten_idx
  on public.nha_cung_cap (ten_nha_cung_cap);
create index if not exists nha_cung_cap_dien_thoai_idx
  on public.nha_cung_cap (dien_thoai);

comment on table public.nha_cung_cap is 'Danh mục nhà cung cấp (/nha-cung-cap).';
comment on column public.nha_cung_cap.ma_nha_cung_cap is 'Mã nhà cung cấp (duy nhất, VD NCC001).';
comment on column public.nha_cung_cap.ten_nha_cung_cap is 'Tên nhà cung cấp.';
comment on column public.nha_cung_cap.dia_chi is 'Địa chỉ nhà cung cấp.';
comment on column public.nha_cung_cap.so_tien_no is 'Số tiền nợ hiện tại của nhà cung cấp.';
comment on column public.nha_cung_cap.ma_so_thue_cccd is 'Mã số thuế / CCCD chủ hộ.';
comment on column public.nha_cung_cap.rui_ro_hoa_don is 'Rủi ro về hóa đơn.';
comment on column public.nha_cung_cap.van_ban_tham_chieu is 'Văn bản tham chiếu.';
comment on column public.nha_cung_cap.dien_thoai is 'Số điện thoại liên hệ.';
comment on column public.nha_cung_cap.la_doi_tuong_noi_bo is 'Có phải đối tượng nội bộ hay không.';
comment on column public.nha_cung_cap.la_tong_cong_ty_chi_nhanh is 'Có phải tổng công ty / chi nhánh hay không.';
