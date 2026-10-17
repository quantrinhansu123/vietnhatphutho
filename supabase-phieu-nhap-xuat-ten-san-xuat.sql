-- Ten san xuat snapshot tren tung dong phieu nhap / xuat kho.
-- Dong TP: ten_sp = ten ban hang, ten_san_xuat = ten SX luc lap phieu (ma_sp chinh la ma AMIS).
-- Dong NVL: khong dung cot nay (da co ten_nvl_sx). Chay trong Supabase SQL Editor, idempotent.
-- Code server tu strip cot khi DB chua migrate (WAREHOUSE_SLIP_TEN_SX_COLUMNS) nen deploy truoc, migrate sau van chay.

alter table public.phieu_nhap_kho add column if not exists ten_san_xuat text;
alter table public.phieu_xuat_kho add column if not exists ten_san_xuat text;

do $$
begin
  if to_regclass('public.phieu_xuat_nhap_kho') is not null then
    alter table public.phieu_xuat_nhap_kho add column if not exists ten_san_xuat text;
  end if;
end $$;

comment on column public.phieu_nhap_kho.ten_san_xuat is 'Ten SX snapshot dong TP (ten_sp = ten ban hang). NVL khong dung (da co ten_nvl_sx).';
comment on column public.phieu_xuat_kho.ten_san_xuat is 'Ten SX snapshot dong TP (ten_sp = ten ban hang). NVL khong dung (da co ten_nvl_sx).';

-- Preview dong cu thieu ten SX (khong backfill tu dong: 1 ma AMIS co the anh xa nhieu ten SX):
-- select ma_phieu, ma_sp, ten_sp from public.phieu_nhap_kho
--  where (ten_san_xuat is null or btrim(ten_san_xuat) = '') and btrim(coalesce(ma_sp, '')) <> '';
