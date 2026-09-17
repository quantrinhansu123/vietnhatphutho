# bao_cao_ngay

| **Bảng** | `bao_cao_ngay` |
| **Tab** | `bao-cao-ngay` → `/bao-cao-ngay` (card **Báo cáo ngày** trong `/phieu-bao-cao`) + `bao-cao-ngay-list` → `/danh-sach-bao-cao-ngay` (card **Danh sách báo cáo ngày** trong `/danh-sach-bao-cao`) |
| **SQL** | `supabase-bao-cao-ngay.sql` (unique `ngay` where `deleted_at is null` + soft delete `deleted_at`) |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/bao-cao-ngay` | `?ngay&tu_ngay&den_ngay&limit` (tối đa 1000), sort `ngay desc`, ẩn `deleted_at != null` (thêm `?includeDeleted=1` để xem cả đã xóa) |
| POST | `/api/bao-cao-ngay` | unique `ngay` — trùng trả 409 (1 ngày = 1 báo cáo) |
| PUT | `/api/bao-cao-ngay/:id` | cập nhật toàn bộ báo cáo (trùng ngày trả 409) |
| DELETE | `/api/bao-cao-ngay/:id` | **xóa mềm** (`deleted_at`, ẩn khỏi danh sách); `?hard=1` để xóa vĩnh viễn |
| POST | `/api/bao-cao-ngay/:id/restore` | khôi phục đã xóa mềm |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/bao-cao-ngay/index.tsx` | `BaoCaoNgayPanel` (props `onBack/onOpenList/editReport/onEditConsumed`) + `BaoCaoNgayListView` (props `onBack/onCreate/onEdit`) + 3 bảng nhập chuẩn (`ThanhPhamTable`/`PheHongTable`/`VatTuTable`) + `BaoCaoNgayPreviewTable` (xem trước/in giống mẫu giấy: header vàng, tổng xanh) + `buildBaoCaoNgayFromSoTron` |
| `src/routes.ts` | `bao-cao-ngay` → `/bao-cao-ngay`, `bao-cao-ngay-list` → `/danh-sach-bao-cao-ngay` |
| `src/app/menus.tsx` | Card Báo cáo ngày trong `REPORT_FORM_MENU_ITEMS` + Danh sách báo cáo ngày trong `REPORT_LIST_MENU_ITEMS` + `TAB_TITLE_MAP` |
| `src/app/tabAccess.ts` | alias `bao-cao-ngay` → `bao-cao-ngay-list` + implied hub `report-forms`/`report-lists` |
| `src/components/layout/NavButtons.tsx` | `BACK_TAB_MAP`: `bao-cao-ngay` → `report-forms`, `bao-cao-ngay-list` → `report-lists` |
| `src/features/registry.ts` | `bao_cao_ngay` entry |

## Nghiệp vụ

- **Thêm mới:** chọn ngày (`SoTronDatePicker`) → **tự động** fill từ sổ trộn (`GET /api/so-tron?ngay=YYYY-MM-DD&limit=1000`, có nút `Lấy lại từ sổ trộn`) → cho sửa tay trước khi lưu. Không có trường C1/nhân sự (cột `nhan_su_c1` cũ chỉ giữ tương thích đọc).
- **Thành phẩm:** gom `bang_san_pham` theo mã SP (`ma_sp` fallback `ten_sp`), Σ `so_luong` + Σ `trong_luong`. Cột sản phẩm là ô search danh mục **`san_pham` theo mã AMIS + `ten_ghep`** (hiển thị `ten_ghep`), **lưu đúng `san_pham_id`** (nhập tay tự do vẫn được, id rỗng).
- **Phế hỏng trong ca:** gom `bang_hang_loi` theo `ten_loi`, Σ `so_luong`; cột Đợt không có trong sổ trộn → để trống, nhập tay.
- **Vật tư theo NVL (gộp theo `material_id` fallback `ma_nvl`, tên `ten_nvl_sx` fallback `ten_nvl`):** cột vật tư là ô search kho **`kho_nvl` theo mã + tên SX/tên SP** (hiển thị `mã — tên SX`), **lưu đúng `material_id`**; khi fill giữ `material_id` từ `bang_ban_giao`. `Tồn đầu ngày` = Σ `ton_dau_ca` của phiếu ca 12C1/HC1 (không thấy ca này thì Σ toàn ngày); `Nhập VT` = Σ `lay_trong_kho` toàn ngày; `Sử dụng` = Σ `tong_su_dung` toàn ngày (đối chiếu Σ `tong_nvl`); `Tồn trong ngày = Tồn đầu + Nhập − Sử dụng`; `Hao hụt = Tồn đầu + Nhập − Tồn trong` (tự tính lại khi sửa tồn đầu/nhập/tồn trong, cho sửa tay hao hụt).
- **Xem trước phiếu (mục 4 trong panel + modal Xem + bản in):** bảng 12 cột giống mẫu giấy (header vàng, dòng Tổng xanh), số liệu live theo 3 bảng nhập.
- **Danh sách:** Xem (modal 3 bảng đồng nhất UI) / Sửa (mở panel) / Xóa mềm (`deleted_at`).
- **Không dùng** `input type="date"` native — dùng `SoTronDatePicker` (lịch popup tiếng Việt).

## Liên kết

`so_tron` (`tong_nvl`, `tong_nhap_nvl`, `bang_ban_giao.lay_trong_kho/ton_dau_ca/tong_su_dung`)
