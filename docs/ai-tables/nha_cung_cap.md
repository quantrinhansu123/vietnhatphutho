# nha_cung_cap

| **Bảng** | `nha_cung_cap` |
| **Tab** | `suppliers` → `/nha-cung-cap` |

**API:** `server.ts` — CRUD `/api/nha-cung-cap` (Supabase cắt 1000 dòng/request nên API đọc theo lô `range()` để mặc định trả HẾT; tùy chọn `?search=` lọc server-side theo mã/tên/địa chỉ/MST-CCCD/rủi ro/văn bản/SĐT, `?page=&pageSize=` phân trang kèm `total`); `POST /api/nha-cung-cap/import-batch` (`{creates, updates}` → 1 query INSERT batch + 1 query UPSERT `onConflict: ma_nha_cung_cap`)
**UI:** `src/features/nha-cung-cap/index.tsx` — `SuppliersPanel` (phân trang client-side bằng `TablePagination` + `usePagination` như màn hình khách hàng: `supplierPage`/`supplierPageSize` mặc định 100, reset về trang 1 khi đổi filter/tìm kiếm/pageSize)
**Utils:** `src/utils/supplierExcel.ts` — tải mẫu và đọc dữ liệu nhà cung cấp từ Excel/CSV

### Excel/CSV (import batch)

- **Tải mẫu Excel / Tải mẫu CSV** — luôn tải được (không cần sẵn danh sách, cùng header)
- **Xuất Excel** — xuất danh sách hiện tại
- **Tải Excel/CSV lên** — parse chung qua `XLSX.read` (`.csv` đọc dạng text); phân loại client thành insert batch (mã mới) / update batch (mã đã có theo `ma_nha_cung_cap`, thiếu mã → tự sinh `NCCxxx`); trùng mã trong file thì dòng sau ghi đè (last-wins); chỉ bắt buộc tên; gửi chunk 200 dòng/lần tới `POST /api/nha-cung-cap/import-batch`

Liên kết: `Kho` (`/nha-may/kho`, card **Nhà cung cấp** trong `FACTORY_KHO_MENU_ITEMS`) cùng nhóm với `quan_ly_kho`, `kho_nvl`
