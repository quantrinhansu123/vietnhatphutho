# don_hang

| | |
|---|---|
| **Bảng** | `don_hang` |
| **Tab** | `orders` → `/don-hang` |
| **SQL** | `supabase-don-hang-*.sql` (bao gồm `supabase-don-hang-updated-at.sql`, `supabase-don-hang-soft-delete.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/don-hang` | 7475–7645 |
| POST | `/api/don-hang/:id/restore` | khôi phục xóa mềm |

### Xóa mềm (soft delete)

- Cột `deleted_at` (+ `deleted_by`, migration `supabase-don-hang-soft-delete.sql`).
- `GET /api/don-hang` mặc định ẩn đã xóa; `?includeDeleted=1` để xem thùng rác.
- `DELETE` → xóa mềm; `?hard=1` → xóa vĩnh viễn. Frontend có nút "Đơn đã xóa" (khôi phục / xóa vĩnh viễn).
- `POST /api/lenh-sx/from-don-hang/:id` từ chối đơn đã xóa mềm.

Helper parse/lưu JSON `san_pham` (kèm `stt`): ~4986–5550.
Helper bổ sung quy đổi theo cờ thay đổi từ form sửa: ~5376–5455.
Helper tự sinh mã: `generateNextOrderCodeFromDb()` ~2924.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/don-hang/index.tsx` | Panel / logic chính |
| `src/components/shared/Select2.tsx` | Select khách hàng (gõ để tìm) trên form thêm/sửa |
| `src/features/_shared/orderHelpers.ts` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Tạo lệnh SX: `POST /api/lenh-sx/from-don-hang/:id`

### Form đơn hàng

- **Khách hàng**: Select2 (gõ để tìm) lấy từ `/api/khach-hang` (bảng danh mục Khách hàng), bắt buộc chọn.
- **Sản phẩm JSON `san_pham`**: mỗi object có `stt` (1, 2, 3…) theo thứ tự dòng. Form thêm/sửa: kéo thả hoặc cụm action cố định `[Xóa] [↑] [↓]` bên phải; Lên/Xuống disabled ở đầu/cuối. Lưu luôn chuẩn hóa `stt` liên tục. Dữ liệu cũ chưa có `stt` hiển thị theo vị trí mảng.
- **Quy đổi khi thêm/sửa**: tải `san_pham_quy_doi`, áp dụng quy tắc nhóm VTHH và công thức tại `.ai/spec/tinh_toan_quy_doi.md`. Khi sửa, dòng chưa bị tác động hiển thị/giữ nguyên quy đổi trong JSON `san_pham`; chỉ tính theo bảng mới sau khi người dùng đổi dữ liệu ảnh hưởng quy đổi hoặc chọn lại sản phẩm cũ.
- Dòng JSON `san_pham` lưu mã AMIS, `ten_san_xuat`, `ten_ghep` và mảng `ket_qua_quy_doi`; thiếu cấu hình quy đổi vẫn cho phép lưu đơn.
- **`ten_ghep`**: luôn lưu cho mọi loại đơn, **lấy từ `ten_ghep` đã lưu trên danh mục SP** (`OrderProductOption.tenGhep`; thiếu mới ghép lại từ `ten_san_xuat`). Đơn cắt lẻ: nhóm **Đặc/Sóng** thay đúng token **m dài chính** (`doDaiM` trên SP) thành mét cắt (`replaceCutLengthMeters` — kể cả khi m dài không đứng cuối, vd `…6m - 2.1m` cắt 8m → `…8m - 2.1m`); các nhóm VTHH khác giữ luật cũ (thay token mét cuối, thiếu thì thêm `- Nm`). Danh sách, chi tiết và in đơn hàng **chỉ** hiển thị `ten_ghep` đã lưu trong JSON `san_pham` — không ghép lại, không nối thêm dòng tem (tem đã nằm trong `ten_ghep`). In đơn hàng và lệnh SX (thêm/sửa) hiển thị và lưu `ten_ghep`.
- **Ngày giao hàng**: cột `ngay_giao_hang`, migration `supabase-don-hang-ngay-giao-hang.sql`.
- **ĐVT dòng đơn**: theo `allowedOrderUnits` (`src/features/_shared/orderHelpers.ts`) — Đặc/Sóng: `Tấm`/`Cuộn`; Rỗng: `Tấm`; còn lại: `kg`.
- **KG khách hàng nhập**: cột KG/Tổng KG trên mọi loại đơn cho phép nhập tay. Khi có giá trị, JSON `san_pham[]` ưu tiên `tong_kg` này, ghi `nguon_quy_doi = "khach_hang_nhap_kg"`, cập nhật `ket_qua_quy_doi`; nếu ĐVT là Tấm/Cuộn thì suy ra `tl_tam`/`tl_cuon = tong_kg / so_luong`. Backend giữ nguồn nhập tay, không ghi đè bằng định mức danh mục.
- **Đơn theo quy cách khách đặt**: nút `+` xanh nằm trong ô STT (ngoài cùng bên trái, ngay sau số thứ tự), click nhân bản toàn bộ sản phẩm thành dòng ngay bên dưới. Nút lên/xuống cũng nằm trong ô STT; cột thao tác cuối chỉ còn nút xóa. Cột STT đơn cắt lẻ rộng 7rem.
- **Đơn miền nam** (`SOUTH_ORDER_TYPE = 'Đơn miền nam'`): form giống hệt đơn cắt lẻ (Mã AMIS / Tên sản xuất / ĐVT `Tấm` cố định / Dài m / **Độ li ĐM** / Bắc-Trung-Nam / SL tổng / Tổng KG), thêm 2 ô chọn-nhập **Tem** (`SOUTH_TEM_OPTIONS`: 11 loại `1.2li…5li` gợi ý, cho nhập tay qua `allowCustomValue`), **Màu tem** (`Hồng` mặc định, `Vàng` gợi ý, cho nhập tay) và checkbox **Dán Tem 2 Đầu**. Ô **Độ li ĐM** chỉ nhập/hiển thị **số** (vd `0.75`); khi lưu tự thành `do_li_dm = (đm n li)` và chỉ thay segment `(đm …)` trong `ten_ghep`, **không** đổi token `do_li`. Màu lạ (không phải Vàng) quy MV về MVCC. Màng KHÔNG nối thêm (đã có trong tên gốc). JSON `san_pham[]` lưu `tem`, `mau_tem`, `dan_tem_2_dau`, `do_li_dm`, và `mo_ta_tem` (hậu tố tem đã trim, vd `(Dán Tem 1.5li) Màu Hồng MVCC Dán Tem 2 Đầu`; bỏ key khi không chọn tem); `ten_ghep` = tên ghép cắt lẻ (đã thay mét + đm) + hậu tố Full Excel ` (Dán Tem 5li) Màu Hồng MVCC` (+ ` Dán Tem 2 Đầu` nếu tick), MV tự động theo màu (Hồng→MVCC, Vàng→MVKH). Backend (`server.ts` `isCutLikeOrderTypeServer`) validate `dai_m > 0`, tính quy đổi như cắt lẻ, giữ tem/`do_li_dm` khi tạo lệnh SX. Danh sách/chi tiết/in (`OrderPrintSheet` tiêu đề `ĐƠN ĐẶT HÀNG MIỀN NAM`) hiển thị dòng tem.
