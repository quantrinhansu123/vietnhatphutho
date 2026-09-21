# so_giao_ca_mmtb

| Bảng | `so_giao_ca_mmtb` |
| Tab | `so-giao-ca-mmtb` → `/so-giao-ca-mmtb` (card **Sổ giao ca MMTB** trong `/phieu-bao-cao`) + `so-giao-ca-mmtb-list` → `/danh-sach-so-giao-ca-mmtb` (card **Danh sách sổ giao ca MMTB** trong `/danh-sach-bao-cao`) |
| SQL | `supabase-so-giao-ca-mmtb.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/so-giao-ca-mmtb` | `?ngay&ma_may&ca&limit` (tối đa 300), sort `ngay desc, created_at desc` |
| POST | `/api/so-giao-ca-mmtb` | Thêm mới bản ghi sổ giao ca MMTB |
| PUT | `/api/so-giao-ca-mmtb/:id` | Cập nhật sổ giao ca MMTB theo ID |
| DELETE | `/api/so-giao-ca-mmtb/:id` | Xóa sổ giao ca MMTB theo ID |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/so-giao-ca-mmtb/index.tsx` | Panel nhập (`SoGiaoCaMmtbPanel`) với bộ lọc Ngày, Máy, Ca + Danh sách (`SoGiaoCaMmtbListView` date-gated: vào trang chưa hiện gì, chọn ngày mới hiện + dòng đếm `Ngày DD/MM/YYYY: X sổ`). |
| `src/features/so-tron/SoTronDatePicker.tsx` (dùng chung) | Datetimepicker lịch popup tiếng Việt: nút hiển thị `DD/MM/YYYY`, bấm mở lịch tháng (`Tháng M / YYYY`, T2–CN), nút Hôm nay/Xóa. Nhảy năm nhanh: « / » (±1 năm), bấm tiêu đề mở panel gõ năm + lưới 12 tháng. Lưu ISO `YYYY-MM-DD`. |
| `src/features/so-giao-ca-mmtb/StaffSelect.tsx` | Ô chọn `Select2` search được (gõ để tìm, `allowClear`): Trưởng ca lọc `phong_ban='PHÂN XƯỞNG SẢN XUẤT'`, Người kiểm tra lọc `phong_ban='Phòng điều Hành'` từ `/api/nhan-su?format=groups&scope=all` (so sánh không dấu/hoa-thường). Nhận `dropdownParent` khi dùng trong modal. |
| `src/features/so-giao-ca-mmtb/SoGiaoCaMmtbPreviewModal.tsx` | Modal xem trước giao diện phiếu in, cho phép sửa trực tiếp tất cả ô (đặc biệt dòng Tiêu chuẩn do người dùng nhập), có các nút Lưu, Lưu & In, In, Đóng. Font giấy ép `"Times New Roman", Times, serif` đúng như `print.ts` (không dùng `font-serif` Georgia/Cambria thiếu dấu). Footer ký tên mỗi ô `max-w-[250px]` để tên không bị cắt. |
| `src/features/so-giao-ca-mmtb/print.ts` | Tạo HTML và kích hoạt in khổ A4 Landscape (`@page size: A4 landscape; margin: 6mm 8mm;`): từng phiếu (`printSoGiaoCaMmtbSlip`) + danh sách đang lọc (`printSoGiaoCaMmtbList`: STT/Ngày/Ca/Máy/Trưởng ca/Người kiểm tra, kèm điều kiện lọc + dòng tổng + ký tên). |
| `src/features/so-giao-ca-mmtb/types.ts` | Định nghĩa `SoGiaoCaMmtbRecord`, `DongTieuChuan`, `DongCheDoChayRow` (gồm `do_day/chieu_rong/chieu_dai` sau cột Lô), `DongSanPhamRow`, các cột thay màng (9..17), khu khuôn (18..32). |
| `src/App.tsx` | Shell routing render `SoGiaoCaMmtbPanel` và `SoGiaoCaMmtbListView`. |
| `src/routes.ts` | `so-giao-ca-mmtb` → `/so-giao-ca-mmtb`, `so-giao-ca-mmtb-list` → `/danh-sach-so-giao-ca-mmtb`. |
| `src/app/menus.tsx` | Cards trong `REPORT_FORM_MENU_ITEMS` và `REPORT_LIST_MENU_ITEMS`. |
| `src/app/tabAccess.ts` | Aliases và hub implied tabs. |

## Nghiệp vụ

- **Biểu mẫu:** BM-SX-07 "BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY & CHẤT LƯỢNG HÀNG NGÀY".
- **Bộ lọc:** Ngày (`VnDatePicker` Ngày/Tháng/Năm tiếng Việt), Máy (`SearchableSelect`), Ca (`select`). Không hiển thị Lệnh SX, Tên sản phẩm, Quy cách.
- **Ngày giờ VN:** Ngày dùng `SoTronDatePicker` (lịch popup, hiển thị `DD/MM/YYYY`, lưu ISO `YYYY-MM-DD`); giờ kiểm tra (`Thời gian`, `Giờ KT`) dùng `TimePicker24h` khung 24h (`00:00`–`23:59`).
- **Nhân sự:** Trưởng ca `phong_ban='PHÂN XƯỞNG SẢN XUẤT'`; Người kiểm tra `phong_ban='Phòng điều Hành'` từ `/api/nhan-su?format=groups&scope=all`.
- **Tiêu chuẩn người dùng nhập:** Gộp 29 cột từ Bơm đến hết Lô ép quang, lưu vào `dong_tieu_chuan.noi_dung`; Ghi chú riêng. Dữ liệu cũ được ghép để hiển thị khi chưa có `noi_dung`. Áp dụng ở form, xem trước và in.
- **Cỡ chữ:** 14px, chữ phụ 13px.
- **Xem & In trước khi in:** Modal mô phỏng trang in A4 Landscape, chỉnh sửa trực tiếp, kèm các nút Lưu, Lưu & In, In.
