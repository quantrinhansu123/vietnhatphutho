-- Thông số SX suy luận + định mức (đm n li) lưu riêng.
-- Không đổi unique: vẫn giữ unique ma_sp (nếu còn) và chặn logic
-- trùng bộ ma_amis + ten_sp + ten_san_xuat ở API. Không tạo unique mới.

alter table public.san_pham
  add column if not exists do_li text,
  add column if not exists do_li_dm text,
  add column if not exists do_day_m text,
  add column if not exists do_dai_m text,
  add column if not exists mang text,
  add column if not exists hang_phe text,
  add column if not exists ten_goc text;

comment on column public.san_pham.do_li is 'Do li (AMIS hoặc suy luan): vd 5.0li / 6ZEM.';
comment on column public.san_pham.do_li_dm is 'Doan (đm n li) extract tu ten_san_xuat, chuan hoa.';
comment on column public.san_pham.do_day_m is 'Do day / kho (m) suy luan tu ma_amis *…m.';
comment on column public.san_pham.do_dai_m is 'Met dai (Sóng: mac dinh m dai nhat khi gom bien the).';
comment on column public.san_pham.mang is 'Mang: ECO / STD / SUN PC / HA / custom.';
comment on column public.san_pham.hang_phe is 'Hang phe: hàng 100% NS Off / hàng chạy 100% phế / …';
comment on column public.san_pham.ten_goc is 'Phan ten goc dung de ghep ten hien thi.';

select 'OK - Đã thêm cột thông số SX (do_li, do_li_dm, do_day_m, do_dai_m, mang, hang_phe, ten_goc). Unique hiện có không đổi.' as result;
