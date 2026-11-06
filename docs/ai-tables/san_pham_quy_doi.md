# san_pham_quy_doi

| | |
|---|---|
| **Bảng** | `san_pham_quy_doi` → FK `san_pham.id` |
| **Tab** | Không còn route riêng; nhập trong `/san-pham` |
| **SQL** | `supabase-san-pham-quy-doi.sql`, `supabase-san-pham-quy-doi-trong-luong-cuon.sql`, `supabase-san-pham-quy-doi-bo-don-vi-tinh.sql` |

**API:** CRUD `/api/bang-quy-doi-san-pham`; import lô `POST /api/bang-quy-doi-san-pham/import` (giữ nguyên số file — `,` → `.`, **không làm tròn** `trong_luong_kg_tam` / `trong_luong_kg_cuon`); export CSV `GET /api/export-bang-quy-doi-san-pham` trong `server.ts`  
**UI:** `src/features/san-pham/index.tsx`  
**Công thức dùng chung:** `src/utils/productConversionCalculation.ts`
**CSV:** `src/utils/productConversionCsv.ts`  
**Menu:** Nhà máy → QC (`factory-qc`)

Danh sách join `san_pham`; bảng quy đổi chỉ lưu một dòng cho mỗi `san_pham_id` và các thông số. ĐVT hiển thị lấy từ `san_pham.don_vi`, không lưu trong bảng quy đổi.

Tạo biến thể từ đơn hàng: `src/features/don-hang/variantConversions.ts` tính đủ 9 trường theo khổ/dài/độ li ĐM hoặc định mức kg/tấm nhập tay, không lấy Tổng KG đơn. Trọng lượng cắt 3 số lẻ, diện tích làm tròn 2. Thiếu căn cứ thì xóa số dẫn xuất cũ và yêu cầu bổ sung. API từ chối mảng quy đổi nhiều dòng thay vì âm thầm chỉ lưu dòng đầu; không đổi cấu trúc một bộ quy đổi/SP.
