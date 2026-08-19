# san_pham_quy_doi

| | |
|---|---|
| **Bảng** | `san_pham_quy_doi` → FK `san_pham.id` |
| **Tab** | Không còn route riêng; nhập trong `/san-pham` |
| **SQL** | `supabase-san-pham-quy-doi.sql`, `supabase-san-pham-quy-doi-trong-luong-cuon.sql`, `supabase-san-pham-quy-doi-bo-don-vi-tinh.sql` |

**API:** CRUD `/api/bang-quy-doi-san-pham`; import lô `POST /api/bang-quy-doi-san-pham/import`; export CSV `GET /api/export-bang-quy-doi-san-pham` trong `server.ts`  
**UI:** `src/features/san-pham/index.tsx`  
**CSV:** `src/utils/productConversionCsv.ts`  
**Menu:** Nhà máy → QC (`factory-qc`)

Danh sách join `san_pham`; bảng quy đổi chỉ lưu một dòng cho mỗi `san_pham_id` và các thông số. ĐVT hiển thị lấy từ `san_pham.don_vi`, không lưu trong bảng quy đổi.
