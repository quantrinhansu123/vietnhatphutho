-- Chạy trong Supabase SQL Editor (an toàn khi chạy lại)
-- Thêm cột sản phẩm dạng JSONB + các cột cần thiết cho bảng don_hang.
-- Mỗi phần tử san_pham: { "ma_sp", "ten_sp", "don_vi", "so_luong" }

alter table public.don_hang
  add column if not exists trang_thai text default 'Chờ sx',
  add column if not exists san_pham jsonb not null default '[]'::jsonb;

comment on column public.don_hang.trang_thai is
  'Trạng thái đơn hàng: Chờ sx, Đang sx, Hoàn thành, Hủy.';
comment on column public.don_hang.san_pham is
  'Danh sách sản phẩm trong đơn: ma_sp, ten_sp, don_vi, so_luong.';

-- Gộp dữ liệu cũ (1 SP / dòng) sang jsonb nếu cột đang rỗng
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'don_hang'
      and column_name = 'ma_hang'
  ) then
    update public.don_hang
    set san_pham = jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'ma_sp', nullif(trim(ma_hang::text), ''),
          'ten_sp', nullif(trim(ten_hang::text), ''),
          'don_vi', nullif(trim(don_vi::text), ''),
          'so_luong', so_luong
        )
      )
    )
    where (san_pham is null or san_pham = '[]'::jsonb)
      and coalesce(nullif(trim(ma_hang::text), ''), nullif(trim(ten_hang::text), '')) is not null;
  end if;
end $$;

-- Bỏ các cột SP cũ (đã gộp vào san_pham jsonb)
alter table public.don_hang
  drop column if exists ma_hang,
  drop column if exists ten_hang,
  drop column if exists don_vi,
  drop column if exists so_luong;