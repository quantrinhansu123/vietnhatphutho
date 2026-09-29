# kho_nvl

| | |
|---|---|
| **Bảng** | `kho_nvl` |
| **Tab** | `materials` → `/kho-nvl` (danh mục); tồn theo kho/ngày qua `inventory-catalog` → `/kho-hang` |
| **SQL** | `supabase-kho-nvl.sql`, `supabase-kho-nvl-ten-kho.sql` (`ten_kho`), `supabase-kho-nvl-loai-kho.sql` (`loai_kho` = mã kho, backfill từ `quan_ly_kho`), `supabase-kho-nvl-unique-ma-ten-sx-kho.sql` (unique bộ 4 `ma_npl, ten_npl, ten_nvl_sx, ten_kho`) |
| **Fix precision** | `supabase-kho-nvl-precision.sql` (giữ số lẻ, không bị làm tròn) |
| **Ảnh thực tế** | `supabase-kho-nvl-anh-thuc-te.sql` — link Cloudinary số cân / số bao thực tế |
| **QR đã cấp** | `supabase-ma-qr-nvl.sql` — cấp một mã QR cho mỗi đơn vị nhập kho, lưu lịch sử in và trạng thái |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/kho-nvl?ten_kho=` | Có `ten_kho` thì chỉ dòng đúng kho (không phân biệt hoa thường / dấu). Bỏ trống = toàn bộ danh mục |
| GET | `/api/kho-nvl/ma-qr?ma_npl=...&ten_kho=...` | Danh sách QR NVL đã cấp |
| POST | `/api/ma-qr-nvl/danh-dau-in` | Ghi lịch sử in lại QR NVL |
| PATCH | `/api/ma-qr-nvl/:id/trang-thai` | Đổi trạng thái QR NVL |
| POST | `/api/kho-nvl` | ~8118 |
| POST | `/api/kho-nvl/import-batch` | insert `creates` + upsert `updates` theo `id` (client 200 dòng/lần) |
| POST | `/api/kho-nvl/fill-total-kg` | ~8146 |
| PATCH | `/api/kho-nvl/:id` | ~8195 |
| DELETE | `/api/kho-nvl` (bulk `{ ids }`) | ~8237 |
| DELETE | `/api/kho-nvl/:id` | ~8290 |
| GET | `/api/ton-kho-nvl?from&to&ten_kho` | Tồn kỳ: bỏ `ten_kho` = toàn bộ 4 kho lõi để frontend TỔNG HỢP gộp theo mã; kèm `ten_kho` cụ thể = đúng kho đó (chi tiết / chuyển kho nguồn). Danh sách `kho_nvl` + `nhap_kho`. Sau `supabase-phieu-nhap-xuat-id-danh-muc.sql`, chỉ cộng phiếu `loai_danh_muc = kho_nvl` và `id_danh_muc` đúng id dòng `kho_nvl` đang sống (phiếu của dòng đã xóa không cộng vào dòng tạo lại). Chưa chạy SQL thì vẫn cộng theo mã + tên + tên sản xuất + kho |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-nvl/index.tsx` | `/kho-nvl` liệt kê tách riêng từng kho (unique mã + tên + tên SX + kho): bỏ trống hoặc chọn đúng "Kho NVL" = toàn bộ bảng kho-nvl; chọn kho NVL cụ thể khác (Chính/Phụ/PC) = chỉ kho đó. Tồn đầu / Nhập / Xuất / Tồn cuối tính riêng đúng kho qua `GET /api/ton-kho-nvl` (toàn nhóm thì không gửi `ten_kho`) |
| `src/features/kho-hang/index.tsx` | Kho hàng — liệt kê đầy đủ tất cả các kho; chọn đúng "Kho NVL" = toàn bộ bảng kho-nvl tách riêng từng kho (`warehouseFilter=""`), chọn kho NVL cụ thể khác = chỉ kho đó. Kho thành phẩm vẫn `ThanhPhamStockPanel` |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |

**Hai lối vào:** `/kho-nvl` & `/san-pham` = danh mục CRUD. `/kho-hang` = cùng UI danh mục, lọc theo tên kho đã chọn.


## Liên kết

Phiếu xuất nhập (`phieu_xuat_nhap_kho`) cập nhật tồn kho NVL.

**NVL kho-only (chốt):** phiếu nhập NVL (`POST`/`PUT` nhập `loaiKho=nvl`), phiếu nhập tổng hợp và chuyển kho NVL (hoàn thành/hủy) tự `ensure` master `kho_nvl` theo unique `ma_npl+ten_npl+ten_nvl_sx+ten_kho` (đúng kho đó thì bỏ qua, thiếu mới thêm dòng của kho nhận; cùng mã ở kho khác vẫn thêm). Dòng mới, hoặc dòng kho nhận đang trống phân loại, ghi `phan_loai` là Nguyên vật liệu chính / phụ theo dòng phiếu — `ensureKhoNvlCatalogForNvlLines` trong `server.ts`. Không ghi `nhap_kho` cho NVL nữa nên PTĐM (`fetch /api/kho-nvl`) thấy hàng mới ngay.

**View gộp Kho NVL (Tất cả / đúng "Kho NVL"):** khi đã chọn kỳ, ẩn dòng trùng mã có Tồn đầu = Nhập = Xuất = 0 nếu cùng mã đã phát sinh ở kho khác — `filterDuplicateZeroWarehouseRows` (`src/features/_shared/recordHelpers.ts`), dùng trong `displayedMaterials` → `visibleMaterials` (`src/features/kho-nvl/index.tsx`). Master cũ Kho NVL 0/0/0 không còn che dòng Kho NVL Phụ vừa nhập; lọc kho cụ thể và dữ liệu gốc giữ nguyên.

### Excel danh mục NVL

- **Tải mẫu Excel** / **Tải Excel lên** — `src/utils/materialCatalogExcel.ts`
- Cột khớp bảng + form: Mã NPL, Tên, ĐV, Tổng kg, Tồn đầu, Nhập, Xuất, Kg nhựa/túi/lõi, Khổ cuộn, Chiều dài ĐV
- Ô trống vẫn đẩy lên (null); tạo mới cần Mã + Tên; cập nhật thiếu tên thì giữ tên cũ
- Import Excel/CSV: insert batch / update batch 200 dòng qua `POST /api/kho-nvl/import-batch`. Khớp dòng đã có theo bộ `ma_npl` + `ten_npl` + `ten_nvl_sx` + `ten_kho` (unique `kho_nvl_ma_ten_sx_kho_key`), không theo riêng mã. Trùng bộ đó trong file thì dòng sau ghi đè. Ô Kho trống chỉ cập nhật khi bộ mã/tên/tên sản xuất khớp đúng một kho.
- Mẫu 2 cột cũ tách riêng: **Mẫu cập nhật Tổng kg** / **Nhập Tổng kg**
