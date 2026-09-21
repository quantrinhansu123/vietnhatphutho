# bao_cao_ngay

| **Bảng** | `bao_cao_ngay` |
| **Tab** | `bao-cao-ngay` → `/bao-cao-ngay` (card **Báo cáo ngày** trong `/phieu-bao-cao`) + `bao-cao-ngay-list` → `/danh-sach-bao-cao-ngay` (card **Danh sách báo cáo ngày** trong `/danh-sach-bao-cao`) |
| **SQL** | `supabase-bao-cao-ngay.sql` (unique `ngay` where `deleted_at is null` + soft delete `deleted_at`) + `supabase-bao-cao-ngay-hao-hut-thong-ke.sql` (cột `hao_hut_thong_ke` jsonb) + `supabase-bao-cao-ngay-hao-hut-ghi-chu.sql` (cột `hao_hut_ghi_chu` text) |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/bao-cao-ngay` | `?ngay&tu_ngay&den_ngay&limit` (tối đa 1000), sort `ngay desc`, ẩn `deleted_at != null` (thêm `?includeDeleted=1` để xem cả đã xóa) |
| POST | `/api/bao-cao-ngay` | unique `ngay` — trùng trả 409 (1 ngày = 1 báo cáo). Nhận thêm `hao_hut_thong_ke[]` + `hao_hut_ghi_chu` (thiếu cột trên DB cũ → tự retry không kèm cột) |
| PUT | `/api/bao-cao-ngay/:id` | cập nhật toàn bộ báo cáo (trùng ngày trả 409). Nhận thêm `hao_hut_thong_ke[]` + `hao_hut_ghi_chu` (retry tương tự POST) |
| DELETE | `/api/bao-cao-ngay/:id` | **xóa mềm** (`deleted_at`, ẩn khỏi danh sách); `?hard=1` để xóa vĩnh viễn |
| POST | `/api/bao-cao-ngay/:id/restore` | khôi phục đã xóa mềm |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/bao-cao-ngay/index.tsx` | `BaoCaoNgayPanel` (props `onBack/onOpenList/editReport/onEditConsumed`, 2 tab sau khi chọn ngày: **Báo cáo ngày** + **Hao hụt thống kê**) + `BaoCaoNgayListView` (props `onBack/onCreate/onEdit`) + 3 bảng nhập chuẩn (`ThanhPhamTable`/`PheHongTable`/`VatTuTable`) + `BaoCaoNgayPreviewTable` (xem trước/in giống mẫu giấy: header vàng, tổng xanh) + `buildBaoCaoNgayFromSoTron` + tab Hao hụt (`buildHaoHutThongKeFromSoTron` + `HaoHutThongKeEditor` + `BaoCaoNgayHaoHutPreview`) |
| `src/routes.ts` | `bao-cao-ngay` → `/bao-cao-ngay`, `bao-cao-ngay-list` → `/danh-sach-bao-cao-ngay` |
| `src/app/menus.tsx` | Card Báo cáo ngày trong `REPORT_FORM_MENU_ITEMS` **trỏ thẳng `bao-cao-ngay-list`** (mở danh sách trước, thêm/sửa từ đó) + Danh sách báo cáo ngày trong `REPORT_LIST_MENU_ITEMS` + `TAB_TITLE_MAP` |
| `src/app/tabAccess.ts` | alias `bao-cao-ngay` → `bao-cao-ngay-list` + implied hub `report-forms`/`report-lists` |
| `src/components/layout/NavButtons.tsx` | `BACK_TAB_MAP`: `bao-cao-ngay` → `report-forms`, `bao-cao-ngay-list` → `report-lists` |
| `src/features/registry.ts` | `bao_cao_ngay` entry |

## Nghiệp vụ

- **Thêm mới:** chọn ngày (`SoTronDatePicker`) → hiện 2 tab (**Báo cáo ngày** | **Hao hụt thống kê**) → **tự động** fill từ sổ trộn (`GET /api/so-tron?ngay=YYYY-MM-DD&limit=1000`, có nút `Lấy lại từ sổ trộn`) → cho sửa tay trước khi lưu. Không có trường C1/nhân sự (cột `nhan_su_c1` cũ chỉ giữ tương thích đọc).
- **Thành phẩm:** gom `bang_san_pham` theo mã SP (`ma_sp` fallback `ten_sp`), Σ `so_luong` + Σ `trong_luong`. Cột sản phẩm là ô search danh mục **`san_pham` theo mã AMIS + `ten_ghep`** (hiển thị `ten_ghep`), **lưu đúng `san_pham_id`** (nhập tay tự do vẫn được, id rỗng). **Không nút Thêm dòng** (tổng hợp từ sổ trộn, chỉ sửa/xóa tay từng dòng).
- **Phế hỏng trong ca:** gom `bang_hang_loi` theo `ten_loi`, Σ `so_luong`; cột Đợt không có trong sổ trộn → để trống, nhập tay. **Không nút Thêm dòng** (tổng hợp).
- **Vật tư theo NVL (gộp theo `material_id` fallback `ma_nvl`, tên `ten_nvl_sx` fallback `ten_nvl`):** cột vật tư là ô search kho **`kho_nvl` theo mã + tên SX/tên SP** (hiển thị `mã — tên SX`), **lưu đúng `material_id`**; khi fill giữ `material_id` từ `bang_ban_giao`. `Tồn đầu ngày` = Σ `ton_dau_ca` của phiếu ca 12C1/HC1 (không thấy ca này thì Σ toàn ngày); `Nhập VT` = Σ `lay_trong_kho` toàn ngày; `Sử dụng` = Σ `tong_su_dung` toàn ngày (đối chiếu Σ `tong_nvl`); `Tồn trong ngày = Tồn đầu + Nhập − Sử dụng`; `Hao hụt = Tồn đầu + Nhập − Tồn trong` (tự tính lại khi sửa tồn đầu/nhập/tồn trong, cho sửa tay hao hụt). **Không nút Thêm dòng** (tổng hợp theo NVL).
- **Hao hụt thống kê (tab 2, lưu trong `hao_hut_thong_ke: [{ma_may, ten_may, muc_tieu, rows: [{ca, truong_ca, truong_ca_options[], hao_hut_am, tp_dat, phe_kg, ghi_chep[], danh_gia}]}]` + `hao_hut_ghi_chu` text):** thống kê từ sổ trộn **theo máy + theo ca** — **không thêm/bớt máy, ca** (1 máy = 1 bảng, 1 phiếu/ca = 1 dòng). Tiêu đề bảng/in là `Hao Hụt Thống Kê Ngày D/M/YYYY` (không chữ "Lưu Ý"). Mỗi ca có ô số riêng `Hao hụt âm [kg]`, `TP đạt [kg]` + `Phế [kg]`; **không ghi chép mặc định** (user tự bấm Thêm dòng ghi chép). **Trưởng ca tra lại từ lịch phân công:** `GET /api/phan-cong-nhan-su?ngay_lam_viec=YYYY-MM-DD&ca=<ca>` theo từng ca trong ngày (server lọc ca chuẩn hóa) → lọc máy client (`ma_may`/`may`, nới lỏng chứa nhau như sổ trộn) → resolve tên qua `/api/nhan-su?format=groups&scope=all` + `/api/nhan-su/by-code` (cache danh mục) → vai trò Trưởng ca trước rồi tới cả tổ, hợp nhất với ứng viên nhúng trong phiếu (`nhan_su_chi_tiet` + `nhan_su`). Dropdown **chỉ hiện vai trò Trưởng ca** (nhận cả không dấu "Truong ca"); khi máy+ca đó chưa xếp trưởng ca nào thì fallback cả tổ để không kẹt. Lý do phải tra lại: `nhan_su` trong phiếu chỉ là tên cả tổ gộp phẩy, phiếu cũ/ca chưa đồng bộ thì rỗng nên dropdown trống. Mặc định lấy người đầu tiên tra được (đúng trưởng ca máy+ca+ngày); ô nào user đã chọn tay thì fill lại giữ nguyên (đánh dấu theo key ngày|||máy|||ca), còn lại cập nhật theo lịch mới nhất. Chế độ sửa (giữ số liệu phiếu) vẫn tra lại để bổ sung dropdown. Có 2 trưởng ca thì lấy người đầu tiên, chọn lại bằng dropdown. Mỗi ca có ô số riêng: `Hao hụt âm [kg]` (= Σ `ton_dau_ca + lay_trong_kho − tong_su_dung − ton_cuoi_ca`), `TP đạt [kg]` (= Σ `trong_luong` SP ca) + `Phế [kg]` (= Σ `so_luong` hàng lỗi, trống thì fallback `tong_loi_hong`). Các dòng ghi chép còn lại (NKSX, Trong ca, tự thêm) cho thêm/xóa. **Đánh giá chỉ `Đạt` / `Không đạt`** (select). **SL Mục Tiêu nhập tay theo máy**; fill lại giữ SL mục tiêu + Trưởng ca + Đánh giá đã chọn. Dữ liệu cũ (dòng text gộp) tự bóc số khi đọc.
- **Xem trước phiếu (tab Báo cáo ngày mục 4 + modal Xem + bản in):** bảng 12 cột giống mẫu giấy (header vàng, dòng Tổng xanh), số liệu live theo 3 bảng nhập.
- **Xem trước hao hụt (tab Hao hụt mục 6 + modal Xem tab Hao hụt + nút In hao hụt):** bảng giống mẫu giấy (`Lưu Ý Hao Hụt Thống Kê Ngày D/M/YYYY`, dòng máy + `SL Mục Tiêu` đỏ, cột `Ca SX | Trưởng Ca | Ghi Chép Trong Ca SX | Đánh Giá Sản Lượng`) + **Ghi chú chung** ở dưới.
- **Danh sách:** vào trang là danh sách **trống** — chỉ hiển thị khi chọn **Từ ngày => Đến ngày** (`SoTronDatePicker`, gọi `GET /api/bao-cao-ngay?tu_ngay&den_ngay`, 1 trong 2 cũng được) + nút Xóa lọc + dòng đếm. **Phân trang 50 bản ghi/trang** (Trước/Sau + số trang + `Trang X/Y`). Xem (modal 2 tab đồng nhất UI) / Sửa (mở panel) / Xóa mềm (`deleted_at`).
- **Form Thêm/Sửa:** header gọn (không nút quay lại, không dòng mô tả).
- **Lưu 1 lần là lưu cả 2 tab:** `handleSave` gửi 1 payload gồm thành phẩm + phế + vật tư + `hao_hut_thong_ke` + `hao_hut_ghi_chu` (1 ngày = 1 báo cáo).
- **Không dùng** `input type="date"` native — dùng `SoTronDatePicker` (lịch popup tiếng Việt).

## Liên kết

`so_tron` (`tong_nvl`, `tong_nhap_nvl`, `bang_ban_giao.lay_trong_kho/ton_dau_ca/tong_su_dung/ton_cuoi_ca`, `bang_san_pham.trong_luong`, `bang_hang_loi.so_luong`, `nhan_su`, `nhan_su_chi_tiet{ma_nhan_su,ten,vai_tro}`, `ghi_chu`), `phan_cong_nhan_su_chi_tiet` (`GET /api/phan-cong-nhan-su?ngay_lam_viec&ca` → lọc máy client, vai trò Trưởng ca), `nhan_su` (`GET /api/nhan-su?format=groups&scope=all` + `/api/nhan-su/by-code` resolve tên)
