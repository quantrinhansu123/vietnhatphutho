# Biểu mẫu Báo cáo tuần (BC01-V3)

| Mục | Giá trị |
|-----|---------|
| Tab | `bao-cao-tuan` → `/bao-cao-tuan` (card **Báo cáo tuần** trong `/phieu-bao-cao`) |
| SQL | Liên kết tính toán số liệu tự động từ bảng `so_tron` theo ngày + máy |
| GET/POST | API `GET /api/so-tron?tu_ngay&den_ngay&limit=1000` lấy dữ liệu; nháp lưu `localStorage` key `bao-cao-tuan-draft-v1` |
| Feature | `src/features/bao-cao-tuan/index.tsx` (`BaoCaoTuanPanel`: props `onBack`) |
| Bộ lọc | `SoTronDatePicker` Từ ngày → Đến ngày, `SearchableSelect` Máy (`normalizeMachines` từ `/api/danh-sach-may`, hiển thị tên máy trong biểu mẫu), Người thực hiện (không bắt buộc). Đã bỏ Phân xưởng. Nút tính lại từ sổ trộn. |
| Mục II | Bảng quản lý máy (mặc định 2 dòng, nút Thêm + Xóa): cột máy là `SearchableSelect` |
| Sự cố / IV / V | Bảng có nút Thêm + cột Xóa từng dòng; Mục V đánh giá bộ phận không để mặc định điểm |
| Mục III | Cột trái text (CBCNV 1, 2… + tự đếm số người); cột phải: nút Thêm mới + `SearchableSelect` nhân viên `status='Đang làm'` (`/api/nhan-su?format=groups&scope=all`) + nội dung đào tạo; dưới là hàng tự học + textarea |
| Phiếu | Tờ giấy BC01-V3 mục I→VI (I tự động tính tổng NVL, TP có màng, TP không màng, phế bắt buộc, số ngày SX, % đạt TB từ `so_tron`), nút In mở cửa sổ HTML A4 dọc |
| Route | `src/routes.ts`: `bao-cao-tuan` → `/bao-cao-tuan` |
| Menu | `src/app/menus.tsx`: `REPORT_FORM_MENU_ITEMS` + `TAB_TITLE_MAP` |
| Quyền | `src/app/tabAccess.ts`: hub `report-forms` implied + `BACK_TAB_MAP` → `report-forms` |
| App | `src/App.tsx`: render `BaoCaoTuanPanel onBack → report-forms` |
| Lưu ý | Không dùng `input type="date"` native — dùng lịch popup tiếng Việt |
