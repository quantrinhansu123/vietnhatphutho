-- Thêm cột vi_tri cho bảng nhan_su (đồng bộ với Vị trí phân quyền = cong_viec)
-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)

alter table public.nhan_su
  add column if not exists vi_tri text;

comment on column public.nhan_su.vi_tri is
  'Vi tri: dong bo tu cong_viec de khớp phân quyền (phong_ban + vi_tri / cong_viec).';

-- Điền sẵn: vi_tri = cong_viec khi còn trống
update public.nhan_su
set vi_tri = nullif(trim(cong_viec), '')
where (vi_tri is null or trim(vi_tri) = '')
  and cong_viec is not null
  and trim(cong_viec) <> '';
