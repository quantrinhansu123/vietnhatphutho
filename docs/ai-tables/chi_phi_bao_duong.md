# chi_phi_bao_duong

| **Bảng** | `chi_phi_bao_duong` |
| **Tab** | `chi-phi-bao-duong` → `/chi-phi-bao-duong` (card **Chi phí bảo dưỡng** trong QC `/nha-may/qc`) |
| **SQL** | `supabase-chi-phi-bao-duong.sql` (migration 2: cột `ngay date` + `chi_tiet jsonb`, unique `(ngay, ma_may)`) |

**API:** `server.ts` — `parseChiPhiBaoDuongBody + GET/POST/PUT/DELETE /api/chi-phi-bao-duong` (sau chi-phi-dien; lọc `?tu_ngay&den_ngay&thang&nam&ma_may`; `POST` luôn INSERT 1 dòng mới kể cả trùng Ngày+Máy, tự tổng tiền từ `chi_tiet`; sửa dòng cũ bằng `PUT /:id`)
**UI:** `src/features/chi-phi-bao-duong/index.tsx` — `ChiPhiBaoDuongPanel`, `ChiPhiBaoDuongList`, `ChiPhiBaoDuongForm`, `ChiPhiBaoDuongSheet`, `ChiPhiBaoDuongSummaryModal`, `ChiPhiBaoDuongPrintSheet` (tờ in dùng CSS `dot-san-xuat-print-*`)
**Utils:** `VnCalendarPicker/parseDateStr/formatDateVN` từ `so-che-do-may`, `MonthYearPickerVi` từ `chi-phi-nhan-cong`

### Nghiệp vụ

- **Màn hình:** Mở từ menu QC (`/nha-may/qc`) → thẻ **Chi phí bảo dưỡng**.
- **Danh sách:** Lọc **Từ ngày → Đến ngày** (`VnCalendarPicker` popup tiếng Việt) + tìm kiếm máy/ghi chú/người lập; thẻ tổng Số dòng + Tổng sửa chữa + Tổng vật tư; cột Ngày (`DD/MM/YYYY`).
- **Thêm mới:** ô chọn Ngày phát sinh + chọn Máy (dropdown `danh_sach_may` + `CHUNG_CTY`/`XE_NANG`).
  - **Phần 1 — Chi phí sửa chữa:** nhiều dòng `[Nội dung | Giá]` + nút Thêm dòng / Xóa dòng, tự cộng tổng phần.
  - **Phần 2 — Vật tư sử dụng:** tương tự phần 1.
  - Nút **Thêm máy mới**: thêm khối máy nữa cùng ngày, logic 2 phần giống hệt; chặn trùng máy trong phiếu; lưu 1 lần cho nhiều máy (trùng Ngày+Máy thì ghi đè).
- **Sửa:** 1 khối máy/ngày, preload các dòng từ `chi_tiet`.
- **Xóa:** confirm theo dòng, `DELETE /api/chi-phi-bao-duong/:id`.
- **Tổng hợp tháng (modal large):** chọn Tháng + nút Xem → bảng theo máy (gộp nhiều ngày, header 2 tầng: Máy | Chi phí + Ghi chú sửa chữa | Chi phí + Ghi chú vật tư) + dòng đỏ `Tổng T/nay` + dòng xanh lá `Tổng T/trước`; nút In.
