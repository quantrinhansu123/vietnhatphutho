# so_tron

| Bảng | `so_tron` |
| Tab | `so-tron` → `/so-tron` (card **Sổ trộn** trong `/phieu-bao-cao`) + `so-tron-list` → `/danh-sach-so-tron` (card **Danh sách sổ trộn** trong `/danh-sach-bao-cao`, vào từ `/nha-may/cong-nhan` → Lịch sử công việc) |
| SQL | `supabase-so-tron.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/so-tron` | `?ngay&ma_may&ca&limit` (tối đa 300), sort `ngay desc, created_at desc` |
| POST | `/api/so-tron` | unique `(ma_may, ngay, ca)` — trùng trả 409 |
| PUT | `/api/so-tron/:id` | cập nhật toàn bộ phiếu |
| DELETE | `/api/so-tron/:id` | xóa phiếu |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/so-tron/index.tsx` | Panel nhập (`SoTronPanel`: props `onBack/onOpenList/editReport/onEditConsumed`) + danh sách (`SoTronListView`: props `onBack/onCreate/onEdit`) |
| `src/features/so-tron/print.ts` | Phiếu in đúng mẫu giấy: 1 tờ A4 ngang (`@page landscape`, font 7.5–9pt, `table-layout: fixed`). Header Ngày/Máy-Ca/Nhân sự → bảng NVL L1..L20 + Tổng → dòng tổng SP → 3 bảng cạnh nhau (Sản phẩm có Cộng | Hàng lỗi có Stt + Cộng | Bàn giao). Đệm dòng trống cho đủ form. In qua cửa sổ riêng (`printSoTronSlip`, pattern `LichLamViecPrintModal`). |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/routes.ts` | `so-tron` → `/so-tron` |
| `src/app/menus.tsx` | Card Sổ trộn trong `REPORT_FORM_MENU_ITEMS` |

## Nghiệp vụ

- **Header:** Chi nhánh cố định Phú Thọ. Chọn Ngày + Máy (1) + Ca (nhiều, trống = tất cả, nguồn từ `cai_dat_thoi_gian`).
- **Lệnh SX:** `GET /api/lenh-sx` → lọc client: **bắt buộc có cả `ngay_bat_dau` và `ngay_ket_thuc`**, ngày chọn nằm trong khoảng (so qua key `YYYYMMDD`) + khớp máy đã chọn (mờ mã/tên) + khớp ít nhất 1 ca đã chọn (chuỗi ca nối `,`). Ô chọn kiểu phiếu trộn định mức (`SearchableMultiSelect<ProductionOrderRow>`, values là object lệnh): nhãn `<mã> - <máy> · <ngày> · <ca>`, tìm theo mã/máy/ca/SP; options = lệnh trong ngày + lệnh thiếu ngày (đã lọc máy/ca).
- **Lệnh SX:** `GET /api/lenh-sx` → lọc client: **bắt buộc có cả `ngay_bat_dau` và `ngay_ket_thuc`**, ngày chọn nằm trong khoảng (so qua key `YYYYMMDD`). Ô chọn kiểu phiếu trộn định mức (`SearchableMultiSelect<ProductionOrderRow>`, values là object lệnh): nhãn `<mã> - <máy> · <ngày> · <ca>`, tìm theo mã/máy/ca/SP; options = lệnh trong ngày + lệnh thiếu ngày; mã đã chọn mà không còn trong danh sách hiện chip cảnh báo. Máy/ca lưu phiếu, nhân sự (`phan-cong-nhan-su`), tồn đầu ca đều rút từ combo của lệnh đã chọn (1 phiếu/combo, trùng thì cập nhật).
- **Cối trộn mẫu:** 1 request `GET /api/bang-tron-vat-tu-dinh-muc?ma_lenh_sx=<mã1>,<mã2>…` cho tất cả lệnh đã chọn (server tách token `,;|/` và khớp từng mã trong `ma_lenh_sx` của phiếu). Hiển thị gom theo **sản phẩm** (tên hiển thị cho công nhân trộn, không hiện tên phiếu; chỉ NVL cối chính, bỏ `nvl_phu`); mỗi cối hiện Lệnh SX, Tổng trọng lượng, Định lượng cối, Ghi chú.
- **Thêm NVL khác:** picker `SearchableMultiSelect` chỉ load **NVL chính** trong kho (loại trừ nhóm vật tư phụ), chọn nhiều 1 lúc; tự thêm đồng thời vào bảng 1 và bảng 4 (kèm tồn đầu kỳ trước).
- **Nhân sự:** CHỈ fill theo ngày + máy + ca đã chọn ở mục 1 (không theo lệnh SX). Tra mã → **tên** bằng 2 lớp: `GET /api/nhan-su/by-code?codes=…` truy vấn trực tiếp bảng `nhan_su` theo mã (tối đa 200 mã) + map từ `/api/nhan-su?format=groups&scope=all`, resolve live lúc hiển thị (ô tay không bị ghi đè). Hiển thị gom theo từng combo Máy-Ca (chỉ tên). Cạnh tiêu đề có link nhỏ mở **Sắp xếp lịch làm việc** trong tab mới + nút **Đồng bộ** (tải lại cả danh mục NV + phân công).
- **Lưu:** 1 phiếu cho mỗi combo Máy-Ca đã chọn (cùng bộ số liệu 4 bảng); trùng máy + ngày + ca thì cập nhật phiếu cũ. Tồn đầu ca lấy theo combo đầu tiên khi chọn nhiều.
- **Bảng 1 NVL thực tế:** fill toàn bộ NVL của mọi lệnh đã chọn, đối chiếu kho NVL (`kho-nvl` → id + tên SX). Hiển thị 3 dòng: mã NVL, tên NVL, tên SX NVL. Gộp theo **id kho** (fallback mã): trùng thì 1 dòng, cộng dồn nguồn lệnh (cột Lệnh SX) và tổng sử dụng. Mỗi dòng lưu `material_id/ten_nvl_sx/lenh_sx[]`. Tồn kỳ trước tra tương thích cả phiếu cũ (theo mã).
- **Bảng 2 Sản phẩm:** người dùng thêm dòng, gợi ý SP từ lệnh đã chọn. Cột Lệnh SX để biết SP thuộc lệnh nào. Trường: lệnh SX, tên hàng, số lượng, định mức, trọng lượng, ghi chú.
- **Bảng 3 Hàng lỗi hỏng:** tên lỗi + số lượng (kg).
- **Bảng 4 Bàn giao ca sau:** loại nhựa tự fill theo NVL cối mẫu. `tồn_đầu_ca` = tồn cuối kỳ trước (cùng máy, phiếu gần nhất khác ngày/ca) — tự fill, cho sửa. `tổng_sử_dụng` = Σ bảng 1 theo mã NVL. `tồn_cuối = lấy_trong_kho + tồn_đầu_ca − tổng_sử_dụng`.

## Liên kết

`lenh_sx`, `bang_tron_vat_tu_dinh_muc`, `phan_cong_nhan_su_chi_tiet`, `danh_sach_may`, `cai_dat_thoi_gian`
