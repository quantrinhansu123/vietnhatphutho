# so_test_mau_nhua

| Bảng | `so_test_mau_nhua` |
| Tab | `so-test-mau-nhua` → `/so-test-mau-nhua` (card **Sổ test mẫu nhựa** trong hub QC `/nha-may/qc`) |
| SQL | `supabase-so-test-mau-nhua.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/so-test-mau-nhua` | `?ngay=YYYY-MM-DD` (1 ngày = 1 sổ), `?tu_ngay&den_ngay`, `limit` tối đa 500, sort `ngay desc` |
| POST | `/api/so-test-mau-nhua` | unique `ngay` — trùng trả 409 |
| PUT | `/api/so-test-mau-nhua/:id` | cập nhật toàn bộ sổ ngày |
| DELETE | `/api/so-test-mau-nhua/:id` | xóa sổ ngày |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/so-test-mau-nhua/index.tsx` | Màn hình duy nhất (`SoTestMauNhuaWorkspace`: props `onBack` — chọn ngày bằng `SoTronDatePicker` lịch popup tiếng Việt thì tự render lưới thêm mới/sửa; cột Loại Hàng là `SearchableSelect` từ kho NVL lọc NVL chính + NVL phụ; quyền theo `useTabAccess('so-test-mau-nhua')`) |
| `src/features/so-test-mau-nhua/model.ts` | Kiểu `PlasticTestRow`/`PlasticTestRecord`, validate ngày + tối đa 200 dòng |
| `src/features/so-test-mau-nhua/print.ts` | In sổ khổ dọc A4 (`printSoTestMauNhua`, đúng mẫu giấy: Ngày tháng + Loại Hàng + Chỉ Số Test [Máy Ép Mẫu, Máy Va Đập, Chỉ Số MFI] + Kết Luận + Người Thực Hiện) |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/routes.ts` | `so-test-mau-nhua` → `/so-test-mau-nhua` |
| `src/app/menus.tsx` | Card trong `FACTORY_QC_MENU_ITEMS` + breadcrumb `TAB_TITLE_MAP` |
| `src/features/nhan-su/menuViews.ts` | Quyền QC (`factory-qc` → `so-test-mau-nhua`) |
| `src/components/layout/NavButtons.tsx` | Back `so-test-mau-nhua` → `factory-qc` |

## Nghiệp vụ

- **Một màn hình theo ngày:** chọn ngày (lịch popup tiếng Việt, năm 1–2999) thì tự tải sổ cũ fill sẵn, chưa có thì lưới trắng để thêm mới. Không dùng `input type="date"` native.
- **Loại Hàng:** chọn từ kho NVL (`/api/kho-nvl` + `normalizeMaterialsInventory`), chỉ lấy phân loại NVL chính + NVL phụ; nếu kho chưa phân loại thì fallback toàn bộ để không trắng màn hình.
- **Lưu:** dòng trống tự bỏ qua; dòng có nội dung mà chưa chọn loại hàng thì báo lỗi đúng số dòng. Chưa có sổ thì POST, có rồi thì PUT; POST trùng 409 (unique `ngay`) tự tải về rồi PUT.
- **In:** nút In mở bản in khổ dọc A4 đúng mẫu giấy, đệm tối thiểu 24 dòng.

## Liên kết

`kho_nvl` (Loại Hàng: NVL chính + NVL phụ)
