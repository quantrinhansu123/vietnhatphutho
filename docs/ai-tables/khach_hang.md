# khach_hang

| **Bảng** | `khach_hang` |
| **Tab** | `customers` → `/khach-hang` |

**API:** `server.ts` — CRUD `/api/khach-hang` (Supabase cắt 1000 dòng/request nên API đọc theo lô `range()` để mặc định trả HẾT; tùy chọn `?search=` lọc server-side theo mã/tên/địa chỉ/MST/SĐT/đơn vị, `?page=&pageSize=` phân trang kèm `total`); `POST /api/khach-hang/import-batch` (`{creates, updates}` → 1 query INSERT batch + 1 query UPSERT `onConflict: ma_khach_hang`); `POST /api/khach-hang/replace`; `GET /api/address-lookup`; `PATCH /api/khach-hang/:id/dia-chi-moi`
**UI:** `src/features/khach-hang/index.tsx` — `CustomersPanel` (phân trang client-side bằng `TablePagination` + `usePagination` như màn hình sản phẩm: `customerPage`/`customerPageSize` mặc định 100, reset về trang 1 khi đổi filter/tìm kiếm/pageSize)
**Utils:** `src/utils/customerExcel.ts` — tải mẫu và đọc dữ liệu khách hàng từ Excel/CSV

### Excel/CSV (import batch)

- **Tải mẫu Excel / Tải mẫu CSV** — luôn tải được (không cần sẵn danh sách, cùng header)
- **Xuất Excel** — xuất danh sách hiện tại
- **Tải Excel/CSV lên** — parse chung qua `XLSX.read` (`.csv` đọc dạng text); phân loại client thành insert batch (mã mới) / update batch (mã đã có theo `ma_khach_hang`, thiếu mã → tự sinh `KHxxx`); trùng mã trong file thì dòng sau ghi đè (last-wins); chỉ bắt buộc tên; gửi chunk 200 dòng/lần tới `POST /api/khach-hang/import-batch`
- Không còn phụ thuộc RPC `replace_khach_hang_from_json` khi nhập thường; không còn gọi POST/PUT từng dòng

Liên kết: `don_hang`, `lenh_xuat_hang`
