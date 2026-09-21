# bao_cao_thang

| **Bảng** | `bao_cao_thang` |
| **Tab** | `bao-cao-thang` → `/bao-cao-thang` (card **Báo cáo tháng** trong `/phieu-bao-cao`) + `bao-cao-thang-list` → `/danh-sach-bao-cao-thang` (card **Danh sách báo cáo tháng** trong `/danh-sach-bao-cao`) |
| **SQL** | `supabase-bao-cao-thang.sql` (bảng `bao_cao_thang` lưu trữ tổng hợp định giá vật tư - nhân công theo tháng và máy từ các đợt sản xuất) |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/bao-cao-thang/aggregate` | `?thang&nam&ma_may` — tự động tổng hợp số liệu từ các bản ghi `dot_san_xuat` của tháng và máy, kèm số liệu so sánh tháng trước |
| GET | `/api/bao-cao-thang` | `?thang&nam&ma_may` — danh sách báo cáo tháng đã lưu; khi chưa chọn tháng-năm trả về `[]` |
| POST | `/api/bao-cao-thang` | Lưu báo cáo tháng mới |
| PUT | `/api/bao-cao-thang/:id` | Cập nhật báo cáo tháng đã lưu |
| DELETE | `/api/bao-cao-thang/:id` | Xóa báo cáo tháng |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/bao-cao-thang/index.tsx` | `BaoCaoThangPanel` (lập/chỉnh sửa báo cáo tháng, tự động tổng hợp từ các đợt) + `BaoCaoThangListView` (danh sách có tìm kiếm theo tháng & năm, chỉ hiển thị dữ liệu khi đã chọn tháng-năm) + `MonthYearPicker` tiếng Việt |
| `src/features/bao-cao-thang/PrintPreviewModal.tsx` | `BaoCaoThangPrintPreviewModal` & `BaoCaoThangPrintSheet` (mẫu in A4 chuẩn Việt Nhật: định giá vật tư, định giá nhân công, chi tiết từng đợt, chữ ký 4 bên) |
| `src/features/bao-cao-thang/types.ts` | Kiểu dữ liệu `BaoCaoThangRow`, `BaoCaoThangDotSummary`, `BaoCaoThangPrintData` |
| `src/routes.ts` | `bao-cao-thang` → `/bao-cao-thang`, `bao-cao-thang-list` → `/danh-sach-bao-cao-thang` |
| `src/app/menus.tsx` | Card Báo cáo tháng trong `REPORT_FORM_MENU_ITEMS` trỏ `bao-cao-thang-list` + Card Danh sách báo cáo tháng trong `REPORT_LIST_MENU_ITEMS` |
| `src/app/tabAccess.ts` | `TAB_ACCESS_ALIASES` + `HUB_IMPLIED_TABS` |
| `src/components/layout/NavButtons.tsx` | `BACK_TAB_MAP` |
| `src/features/registry.ts` | Entry `bao_cao_thang` |

## Nghiệp vụ

- **Thêm mới:** Chọn **Tháng - Năm** (`MonthYearPicker` tiếng Việt) và **Máy** (`SearchableSelect`). Hệ thống tự động gọi API `/api/bao-cao-thang/aggregate` để truy vấn tất cả các đợt sản xuất (`dot_san_xuat`) trong tháng của máy đó.
- **Tổng hợp tự động:**
  - Danh sách chi tiết các đợt sản xuất trong tháng (Đợt 1, 2...: ngày, TL/tiền chính, phụ, thu hồi, hao hụt, TL thực tế, số công, chi phí NC, đơn giá tổng, BQ VT+NC).
  - Bảng I: Kết quả định giá vật tư thực tế tháng (tổng vật tư chính, phụ, giá chưa hao hụt, thu hồi, hao hụt, giá chính thực tế, đơn giá tổng sau hao hụt, chênh lệch và tỉ lệ %).
  - Bảng II: Kết quả định giá nhân công thực tế tháng (trực, đầu máy, cuối máy, tổng công, tổng chi phí nhân công, đơn giá nhân công/kg).
  - So sánh tháng trước: tự động truy xuất báo cáo hoặc đợt của tháng liền kề trước đó của cùng máy để tính các cột chênh lệch.
- **Danh sách báo cáo tháng:**
  - Bộ lọc tìm kiếm theo **Tháng - Năm** và Máy.
  - **Khi vào màn hình danh sách chưa có dữ liệu**; chỉ khi người dùng chọn xong Tháng - Năm mới truy vấn và hiển thị.
  - Hỗ trợ In/Xem chi tiết, Sửa (nạp lại form), và Xóa báo cáo.
