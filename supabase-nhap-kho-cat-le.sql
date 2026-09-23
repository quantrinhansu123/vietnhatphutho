-- Cắt lẻ: mở rộng sổ nhap_kho để giữ 7 thông số ghép tên (copy từ san_pham / dòng mẹ).
-- Lý do: ten_sp hiện chỉ là snapshot tên ghép lúc nhập — replace string khi cắt
-- (đổi do_day_m = khổ rộng, do_dai_m = m dài) dễ sai và mất gốc ở nhát cắt thứ 2.
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

alter table public.nhap_kho
  add column if not exists ten_goc text,
  add column if not exists do_li text,
  add column if not exists do_li_dm text,
  add column if not exists do_day_m text,
  add column if not exists do_dai_m text,
  add column if not exists mang text,
  add column if not exists hang_phe text,
  add column if not exists ma_amis text,
  add column if not exists san_pham_id uuid;

comment on column public.nhap_kho.ten_goc is 'Cắt lẻ: tên gốc copy từ san_pham / dòng mẹ để ghép lại ten_sp khi đổi khổ.';
comment on column public.nhap_kho.do_li is 'Cắt lẻ: độ li (vd 8li) — giữ nguyên khi cắt, chỉ do_day_m/do_dai_m đổi.';
comment on column public.nhap_kho.do_li_dm is 'Cắt lẻ: (đm n li) — giữ nguyên khi cắt.';
comment on column public.nhap_kho.do_day_m is 'Cắt lẻ: khổ rộng m (vd 1.22m) — ĐÂY là nhát cắt xẻ khổ.';
comment on column public.nhap_kho.do_dai_m is 'Cắt lẻ: m dài (vd 30m) — đổi khi cắt ngắn cuộn/tấm.';
comment on column public.nhap_kho.mang is 'Cắt lẻ: màng ECO/STD/... — giữ nguyên khi cắt.';
comment on column public.nhap_kho.hang_phe is 'Cắt lẻ: hàng phế — giữ nguyên khi cắt.';
comment on column public.nhap_kho.ma_amis is 'Cắt lẻ: mã AMIS trace về danh mục SP.';
comment on column public.nhap_kho.san_pham_id is 'Cắt lẻ: id danh mục san_pham gốc (nullable).';

create index if not exists nhap_kho_ma_amis_idx on public.nhap_kho (ma_amis);

-- Backfill best-effort: dòng nhap_kho có ma_sp khớp san_pham.ma_sp thì copy 7 cột.
-- Không chặn khi bảng san_pham thiếu cột (DB cũ).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'san_pham' and column_name = 'ten_goc') then
    update public.nhap_kho as n
    set ten_goc = s.ten_goc,
        do_li = s.do_li,
        do_li_dm = s.do_li_dm,
        do_day_m = s.do_day_m,
        do_dai_m = s.do_dai_m,
        mang = s.mang,
        hang_phe = s.hang_phe,
        ma_amis = s.ma_amis,
        san_pham_id = s.id
    from public.san_pham as s
    where btrim(n.ma_sp) <> ''
      and btrim(n.ma_sp) = btrim(s.ma_sp)
      and n.ten_goc is null;
  end if;
end $$;

select 'OK - nhap_kho đã có 7 cột thông số cắt lẻ.' as result;
