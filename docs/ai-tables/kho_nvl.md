# kho_nvl

| | |
|---|---|
| **Bảng** | `kho_nvl` |
| **Tab** | `materials` → `/kho-nvl` (danh mục); tồn theo kho/ngày qua `inventory-catalog` → `/kho-hang` |
| **SQL** | `supabase-kho-nvl.sql`, `supabase-kho-nvl-ten-kho.sql` |
| **Fix precision** | `supabase-kho-nvl-precision.sql` (giữ số lẻ, không bị làm tròn) |
| **Ảnh thực tế** | `supabase-kho-nvl-anh-thuc-te.sql` — link Cloudinary số cân / số bao thực tế |
| **QR đã cấp** | `supabase-ma-qr-nvl.sql` — cấp một mã QR cho mỗi đơn vị nhập kho, lưu lịch sử in và trạng thái |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/kho-nvl` | ~8090 |
| GET | `/api/kho-nvl/ma-qr?ma_npl=...&ten_kho=...` | Danh sách QR NVL đã cấp |
| POST | `/api/ma-qr-nvl/danh-dau-in` | Ghi lịch sử in lại QR NVL |
| PATCH | `/api/ma-qr-nvl/:id/trang-thai` | Đổi trạng thái QR NVL |
| POST | `/api/kho-nvl` | ~8118 |
| POST | `/api/kho-nvl/fill-total-kg` | ~8146 |
| PATCH | `/api/kho-nvl/:id` | ~8195 |
| DELETE | `/api/kho-nvl` (bulk `{ ids }`) | ~8237 |
| DELETE | `/api/kho-nvl/:id` | ~8290 |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-nvl/index.tsx` | Danh mục NVL tại `/kho-nvl` (CRUD giống main); Kho hàng truyền `warehouseFilter` để lọc theo kho |
| `src/features/kho-hang/index.tsx` | Kho hàng — chọn kho rồi mở cùng panel danh mục NVL/TP (thêm/sửa/xóa như `/kho-nvl` / `/san-pham`) |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |

**Hai lối vào:** `/kho-nvl` & `/san-pham` = danh mục CRUD. `/kho-hang` = cùng UI danh mục, lọc theo tên kho đã chọn.


## Liên kết

Phiếu xuất nhập (`phieu_xuat_nhap_kho`) cập nhật tồn kho NVL.

### Excel danh mục NVL

- **Tải mẫu Excel** / **Tải Excel lên** — `src/utils/materialCatalogExcel.ts`
- Cột khớp bảng + form: Mã NPL, Tên, ĐV, Tổng kg, Tồn đầu, Nhập, Xuất, Kg nhựa/túi/lõi, Khổ cuộn, Chiều dài ĐV
- Ô trống vẫn đẩy lên (null); tạo mới cần Mã + Tên; cập nhật thiếu tên thì giữ tên cũ
- Upsert theo `ma_npl`
- Mẫu 2 cột cũ tách riêng: **Mẫu cập nhật Tổng kg** / **Nhập Tổng kg**
