-- Thêm phân vùng áp dụng cho sản phẩm. Để NULL với dữ liệu cũ chưa được phân loại.
ALTER TABLE public.san_pham
  ADD COLUMN IF NOT EXISTS mien text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'san_pham_mien_check'
      AND conrelid = 'public.san_pham'::regclass
  ) THEN
    ALTER TABLE public.san_pham
      ADD CONSTRAINT san_pham_mien_check
      CHECK (mien IS NULL OR mien IN ('Miền Nam', 'Miền Bắc'));
  END IF;
END $$;

COMMENT ON COLUMN public.san_pham.mien IS 'Miền áp dụng của sản phẩm: Miền Nam hoặc Miền Bắc; NULL là chưa phân loại.';
