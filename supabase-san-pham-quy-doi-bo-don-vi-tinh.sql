-- Mỗi sản phẩm chỉ có một bản ghi quy đổi; ĐVT lấy từ san_pham.don_vi.
drop index if exists public.san_pham_quy_doi_san_pham_don_vi_key;

-- Nếu dữ liệu cũ có nhiều dòng/ sản phẩm, giữ dòng cập nhật mới nhất.
delete from public.san_pham_quy_doi old_row
using public.san_pham_quy_doi keep_row
where old_row.san_pham_id = keep_row.san_pham_id
  and (
    old_row.updated_at < keep_row.updated_at
    or (old_row.updated_at = keep_row.updated_at and old_row.id < keep_row.id)
  );

alter table public.san_pham_quy_doi
  drop constraint if exists san_pham_quy_doi_don_vi_not_blank;

alter table public.san_pham_quy_doi
  drop column if exists don_vi_tinh;

create unique index if not exists san_pham_quy_doi_san_pham_key
  on public.san_pham_quy_doi (san_pham_id);
