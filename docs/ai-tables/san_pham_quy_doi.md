# san_pham_quy_doi

| | |
|---|---|
| **Bảng** | `san_pham_quy_doi` → FK `san_pham.id` |
| **Tab** | `product-conversions` → `/bang-quy-doi-san-pham` |
| **SQL** | `supabase-san-pham-quy-doi.sql` |

**API:** CRUD `/api/bang-quy-doi-san-pham`; import lô `POST /api/bang-quy-doi-san-pham/import`; export CSV `GET /api/export-bang-quy-doi-san-pham` trong `server.ts`  
**UI:** `src/features/bang-quy-doi-san-pham/index.tsx`  
**CSV:** `src/utils/productConversionCsv.ts`  
**Menu:** Nhà máy → QC (`factory-qc`)

Danh sách join `san_pham`; bảng quy đổi chỉ lưu `san_pham_id`, đơn vị và thông số.
ĐVT tạo mới tự lấy từ `san_pham.don_vi`; khi cập nhật chỉ hiển thị và không được thay đổi.
