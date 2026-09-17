# Biểu mẫu Báo cáo tuần (BC01-V3)

| Mục | Giá trị |
|-----|---------|
| Tab | `bao-cao-tuan` → `/bao-cao-tuan` (card **Báo cáo tuần** trong `/phieu-bao-cao`) |
| SQL | *(chưa có — UI nhập tay, tính toán tự động để sau)* |
| GET/POST | *(chưa có API — nháp lưu `localStorage` key `bao-cao-tuan-draft-v1`)* |
| Feature | `src/features/bao-cao-tuan/index.tsx` (`BaoCaoTuanPanel`: props `onBack`) |
| Bộ lọc | `SoTronDatePicker` Từ ngày → Đến ngày (tự gợi ý Tuần/Tháng), `SearchableSelect` Máy (`normalizeMachines` từ `/api/danh-sach-may`) |
| Mục II | Bảng quản lý máy (mặc định 2 dòng, nút Thêm + Xóa): cột máy là `SearchableSelect` |
| Sự cố / IV | Bảng có nút Thêm + cột Xóa từng dòng |
| Mục III | Cột trái text (CBCNV 1, 2… + tự đếm số người); cột phải: nút Thêm mới + `SearchableSelect` nhân viên `status='Đang làm'` (`/api/nhan-su?format=groups&scope=all`) + nội dung đào tạo; dưới là hàng tự học + textarea |
| Phiếu | Tờ giấy BC01-V3 mục I→VI (I nhập tay chưa tính), nút In mở cửa sổ HTML A4 dọc |
| Route | `src/routes.ts`: `bao-cao-tuan` → `/bao-cao-tuan` |
| Menu | `src/app/menus.tsx`: `REPORT_FORM_MENU_ITEMS` + `TAB_TITLE_MAP` |
| Quyền | `src/app/tabAccess.ts`: hub `report-forms` implied + `BACK_TAB_MAP` → `report-forms` |
| App | `src/App.tsx`: render `BaoCaoTuanPanel onBack → report-forms` |
| Lưu ý | Không dùng `input type="date"` native — dùng lịch popup tiếng Việt |
