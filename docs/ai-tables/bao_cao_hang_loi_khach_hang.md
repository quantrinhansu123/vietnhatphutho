# bao_cao_hang_loi_khach_hang

| | |
|---|---|
| **Bảng** | `bao_cao_hang_loi_khach_hang` |
| **Tab** | `hang-loi-khach-hang` → `/bao-cao-hang-loi-khach-hang` (card **Báo cáo hàng lỗi hỏng** trong `/kinh-doanh`) + `thong-ke-hang-loi` → `/thong-ke-hang-loi-khach-hang` (card **Thống kê hàng lỗi hỏng** trong `/nha-may/qc`) |
| **SQL** | `supabase-bao-cao-hang-loi-khach-hang.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/bao-cao-hang-loi-khach-hang` | `?tu_ngay&den_ngay`, `?nhom_vthh` (phân tách dấu phẩy, chọn nhiều), `limit` tối đa 1000, sort `ngay desc` |
| POST | `/api/bao-cao-hang-loi-khach-hang` | tạo phiếu |
| PUT | `/api/bao-cao-hang-loi-khach-hang/:id` | sửa phiếu |
| DELETE | `/api/bao-cao-hang-loi-khach-hang/:id` | xóa phiếu |

Validate (không CHECK constraint trên DB): `ngay` YYYY-MM-DD (năm 1–2999, kể cả nhuận);
`nhom_vthh`/`khu_vuc`/`phan_loai_hang` text tự do (server chuẩn hóa nhẹ về canonical Đặc/Rỗng/Sóng,
Bắc/Trung/Nam để báo cáo gom nhóm ổn định; Bắc→MB, Trung+Nam→HCM&MT);
`phan_loai_hang` dùng chung `WASTE_GRADE_OPTIONS` với form sản phẩm (cho phép rỗng), lưu đúng option đã chọn;
`xu_ly_cong_ty`/`xu_ly_khac` text tự do (báo cáo cộng dồn khi nhập số, bỏ qua khi nhập chữ).

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/bao-cao-hang-loi-khach-hang/model.ts` | Kiểu, options, `buildHangLoiReport` (gom theo nhóm+nội dung: MB/HCM&MT đếm phiếu, Công Ty/Khác cộng SL) |
| `src/features/bao-cao-hang-loi-khach-hang/index.tsx` | `HangLoiKhachHangPanel`: lọc Từ ngày–Đến ngày (`VnCalendarPicker`), thêm/sửa/xóa phiếu; quyền theo `useTabAccess('hang-loi-khach-hang')` |
| `src/features/bao-cao-hang-loi-khach-hang/thong-ke.tsx` | `ThongKeHangLoiPanel`: lọc ngày + multi-select nhóm VTHH, bảng mẫu hình + ghi chú xanh/đỏ + in |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/routes.ts` | `hang-loi-khach-hang` → `/bao-cao-hang-loi-khach-hang`, `thong-ke-hang-loi` → `/thong-ke-hang-loi-khach-hang` |
| `src/app/menus.tsx` | Card Kinh doanh + QC, `PRIMARY_NAV_GROUPS`, `TAB_TITLE_MAP` |
| `src/components/layout/NavButtons.tsx` | Back `hang-loi-khach-hang` → `business`, `thong-ke-hang-loi` → `factory-qc` |
| `src/features/nhan-su/menuViews.ts` | Quyền Kinh doanh (`business` → `hang-loi-khach-hang`), QC (`factory-qc` → `thong-ke-hang-loi`) |

## Không đọc

`App.monolith.backup.tsx` — không chứa logic bảng này.
