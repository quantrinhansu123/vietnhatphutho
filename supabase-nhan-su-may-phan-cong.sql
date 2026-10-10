-- Gán máy phụ trách cho nhân sự (phân công sản xuất theo máy).
-- Để trống = không giới hạn: các ô chọn máy vẫn bình thường, không cố định máy nào.

alter table public.nhan_su
  add column if not exists may_phan_cong jsonb not null default '[]'::jsonb;

comment on column public.nhan_su.may_phan_cong is
  'Mã máy được phân công (mảng ma_may từ danh_sach_may). Trống = không giới hạn máy.';

create index if not exists nhan_su_may_phan_cong_idx
  on public.nhan_su using gin (may_phan_cong);
