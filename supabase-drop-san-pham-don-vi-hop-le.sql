-- Xóa ràng buộc giới hạn đơn vị quy đổi cũ.
-- Có thể chạy nhiều lần nhờ IF EXISTS.
ALTER TABLE public.san_pham
DROP CONSTRAINT IF EXISTS san_pham_don_vi_hop_le;
