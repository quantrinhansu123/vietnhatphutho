-- Bỏ ràng buộc khóa ngoại trên bảng san_pham_quy_doi
-- Điều này cho phép xóa sản phẩm mà không bị lỗi khóa ngoại

-- Kiểm tra ràng buộc hiện tại
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_name = 'san_pham_quy_doi' AND constraint_type = 'FOREIGN KEY';

-- Bỏ khóa ngoại
ALTER TABLE san_pham_quy_doi
DROP CONSTRAINT IF EXISTS san_pham_quy_doi_san_pham_id_fkey;

-- Nếu tên khác, thử tên khác
-- ALTER TABLE san_pham_quy_doi
-- DROP CONSTRAINT IF EXISTS san_pham_quy_doi_sanphamid_fkey;

-- Kiểm tra lại sau khi bỏ
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_name = 'san_pham_quy_doi' AND constraint_type = 'FOREIGN KEY';
