# so_tron

| Bảng | `so_tron` |
| Tab | `so-tron` → `/so-tron` (card **Sổ trộn** trong `/bao-cao-truong-ca-tron`) + `so-tron-list` → `/danh-sach-so-tron` (cùng menu **Báo cáo Trưởng ca + Trộn**, vào từ `/nha-may/cong-nhan`) |
| SQL | `supabase-so-tron.sql` + `supabase-so-tron-tong-hop.sql` (5 cột tổng hợp) + `supabase-so-tron-tong-nhap.sql` (`tong_nhap_nvl`) |

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
| `src/features/so-tron/index.tsx` | Panel nhập (`SoTronPanel`: props `onBack/onOpenList/editReport/onEditConsumed`) + danh sách (`SoTronListView`: props `onBack/onCreate/onEdit`). Cụm nút thao tác dòng dùng `SoTronRowActions` (inline, xem quy ước UI bên dưới). Ô chọn ngày dùng `SoTronDatePicker` (lịch popup 1 nút). |
| `src/features/so-tron/SoTronDatePicker.tsx` | Lịch popup chọn ngày 1 nút (hiển thị DD/MM/YYYY, lưới tháng T2–CN tiếng Việt, nút Hôm nay/Xóa, đóng khi click ngoài/Esc) + `formatNgayVN`. Chọn năm nhanh: nút « / » nhảy ±1 năm, bấm `Tháng M / YYYY` mở panel gõ năm (1–2999) + lưới 12 tháng. Dùng cho ô lọc ngày ở cả 2 màn hình danh sách + toàn bộ ô ngày sổ MMTB — KHÔNG dùng 3 ô Ngày/Tháng/Năm rời (`VnDatePicker`). |
| `src/features/so-tron/PhieuGiaoCaModal.tsx` | Modal xem trước & cho phép sửa trực tiếp phiếu giao ca (nhật ký sản xuất) 2 trang chuẩn theo mẫu thực tế (Trang 1: Vật tư L1..L10 + tồn đầu + lấy kho + tồn cuối; Trang 2: Thành phẩm + Hàng lỗi + Sự cố + 4 Chữ ký). Có các nút: Lưu, Lưu & In, In, Đóng. |
| `src/features/so-tron/printPhieuGiaoCa.ts` | Tạo HTML và kích hoạt in phiếu giao ca 2 trang A4 Portrait (`@page size: A4 portrait`). |
| `src/features/so-tron/print.ts` | (HIỆN KHÔNG DÙNG — nút `In A4` đã bỏ theo yêu cầu, giữ file phòng khi cần lại) Phiếu in đúng mẫu giấy: 1 tờ A4 ngang (`@page landscape`, font 7.5–9pt, `table-layout: fixed`). Header Ngày/Máy-Ca/Nhân sự → bảng NVL L1..L20 + Tổng → dòng tổng SP → 3 bảng cạnh nhau (Sản phẩm có Cộng | Hàng lỗi có Stt + Cộng | Bàn giao). Đệm dòng trống cho đủ form. In qua cửa sổ riêng (`printSoTronSlip`, pattern `LichLamViecPrintModal`). |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/routes.ts` | `so-tron` → `/so-tron`, `so-tron-list` → `/danh-sach-so-tron` |
| `src/app/menus.tsx` | Card Sổ trộn trong `BAO_CAO_TRUONG_CA_TRON_MENU_ITEMS` |

## Nghiệp vụ

- **Header:** Chi nhánh cố định Phú Thọ. Chọn Ngày + Máy (1) + Ca (1, trống = tất cả, nguồn từ `cai_dat_thoi_gian`, `SearchableSelect` đơn). Ô Ca ở Thêm mới chỉ hiện ca **chưa có sổ trộn** của ngày + máy đang chọn (`caCreateOptions` lọc `shiftOptions` bằng `usedCaKeysForDateMachine`, trừ phiếu đang sửa; ca đã tạo mà vẫn chọn thì cảnh báo lưu sẽ cập nhật phiếu cũ).
- **Lệnh SX:** `GET /api/lenh-sx` → lọc client: **bắt buộc có cả `ngay_bat_dau` và `ngay_ket_thuc`**, ngày chọn nằm trong khoảng (so qua key `YYYYMMDD`). Ô chọn kiểu phiếu trộn định mức (`SearchableMultiSelect<ProductionOrderRow>`, values là object lệnh): nhãn `<mã> - <máy> · <ngày> · <ca>`, tìm theo mã/máy/ca/SP; options = lệnh trong ngày + lệnh thiếu ngày; mã đã chọn mà không còn trong danh sách hiện chip cảnh báo. Máy/ca lưu phiếu rút từ combo sẽ lưu (`saveCombos`: combo của lệnh đã chọn, lọc tiếp theo Ca ở mục 1 nếu có); nhân sự (`phan-cong-nhan-su`), tồn đầu ca ưu tiên ngày + máy + ca đã chọn ở mục 1 (1 phiếu/combo, trùng thì cập nhật).
- **Cối trộn mẫu:** 1 request `GET /api/bang-tron-vat-tu-dinh-muc?ma_lenh_sx=<mã1>,<mã2>…` cho tất cả lệnh đã chọn (server tách token `,;|/` và khớp từng mã trong `ma_lenh_sx` của phiếu). Hiển thị gom theo **sản phẩm** (tên hiển thị cho công nhân trộn, không hiện tên phiếu; chỉ NVL cối chính, bỏ `nvl_phu`); mỗi cối hiện Lệnh SX, Tổng trọng lượng sản phẩm (định dạng `1.234,50 kg`, phần nghìn `.`, thập phân `,`, làm tròn 2 chữ số), Định lượng cối, Ghi chú.
- **Thêm NVL khác:** picker `SearchableMultiSelect` chỉ load **NVL chính** trong kho (loại trừ nhóm vật tư phụ), chọn nhiều 1 lúc; tự thêm đồng thời vào bảng 1 và bảng 4 (kèm tồn đầu kỳ trước).
- **Nhân sự:** CHỈ fill theo ngày + máy + ca đã chọn ở mục 1 (không theo lệnh SX). Tra mã → **tên** bằng 2 lớp: `GET /api/nhan-su/by-code?codes=…` truy vấn trực tiếp bảng `nhan_su` theo mã (tối đa 200 mã) + map từ `/api/nhan-su?format=groups&scope=all`, resolve live lúc hiển thị (ô tay không bị ghi đè). Hiển thị gom theo từng combo Máy-Ca (chỉ tên). Cạnh tiêu đề có link nhỏ mở **Sắp xếp lịch làm việc** trong tab mới + nút **Đồng bộ** (tải lại cả danh mục NV + phân công).
- **Lưu:** 1 phiếu cho mỗi combo Máy-Ca sẽ lưu (cùng bộ số liệu 4 bảng); trùng máy + ngày + ca thì cập nhật phiếu cũ. Khi đã chọn Ca ở mục 1 (Lọc theo ca) thì CHỈ tạo cho ca đó (`saveCombos` lọc `orderCombos` bằng `shiftMatchesSingle`, lệch ca thì báo lỗi không lưu); chưa chọn ca mới tạo cho tất cả combo. Tồn đầu ca lấy theo combo đầu tiên khi chọn nhiều.
- **Bảng 1 NVL thực tế:** fill toàn bộ NVL của mọi lệnh đã chọn, đối chiếu kho NVL (`kho-nvl` → id + tên SX). Hiển thị 3 dòng: mã NVL, tên NVL, tên SX NVL. Gộp theo **id kho** (fallback mã): trùng thì 1 dòng, cộng dồn nguồn lệnh (cột Lệnh SX) và tổng sử dụng. Mỗi dòng lưu `material_id/ten_nvl_sx/lenh_sx[]`. Tồn kỳ trước tra tương thích cả phiếu cũ (theo mã). Tờ phiếu giấy: cột **Định mức vật tư** nằm giữa **Tổng** và nút xóa; giá trị = Tổng trọng lượng kg của NVL đó trên phiếu trộn định mức (`tong_khoi_luong`, fallback `% Tổng SL × tổng trọng lượng SP`), định dạng `1.234,50`.
- **Cối thực tế trên tờ phiếu:** dòng Máy-Ca có chọn **Lần** (L1…Ln), **Sản phẩm** (tên hiển thị cho nhân viên, cùng nhãn cối mẫu), **Cối thực tế (kg)**, Mỗi dòng lần có nút **Xác nhận** riêng, đặt trước **Thêm** (dòng dưới dùng **Bỏ**). Bộ đếm số lần nằm trên dòng Máy-Ca. Gõ kg cối chưa tính. **Thêm** tạo một dòng mới bên dưới, các dòng căn cùng một lưới. **Xác nhận** tính đúng lần của dòng đó. Kg NVL ghi dạng `1.234,568` (phần nghìn `.`, thập phân `,`, tối đa 3 chữ số): kg mẫu (`%` → định lượng cối × giá trị / 100; `kg` → giá trị) × (cối thực tế / định lượng cối), làm tròn 2 chữ số. Chỉ ghi NVL của đúng sản phẩm; NVL sản phẩm khác và cột lần khác giữ nguyên. Thiếu định lượng cối thì không chia, không ghi đè. Đổi lần thì hiện lại sản phẩm và kg đã nhập; bớt lần thì cắt dữ liệu lần đó. Lưu trong `coi_tron_mau` phần tử `{ loai: 'lan_coi', items: [{ lan, ma_sp, ten_sp, trong_luong_coi }] }` (không hiện ở danh sách cối mẫu). Kg từng NVL vẫn nằm ở `bang_nvl.lan`.
- **Bảng 2 Sản phẩm:** người dùng thêm dòng, gợi ý SP từ lệnh đã chọn. Cột Lệnh SX để biết SP thuộc lệnh nào. Trường: lệnh SX, tên hàng, số lượng, định mức, trọng lượng, ghi chú + **snapshot quy đổi 1 SP** (`san_pham_id, kg_1_sp, m2_1_sp, m_dai_1_sp, nguon_quy_doi` trong `bang_san_pham` — tự fill từ `lenh_sx.san_pham[]`: `kg_1_sp` lấy trực tiếp, `m2/m_dai` là tổng cả dòng nên chia cho SL đặt; sửa tay 1 chỉ số → `nguon_quy_doi='tay'`; mỗi lần đổi SL hoặc KG/1 SP thì tính lại `SL × KG/1 SP` (gõ thêm chữ số vẫn cập nhật, xóa hết SL thì xóa Trọng lượng)). Server `parseSoTronBody` pass-through `bang_san_pham` nguyên mảng nên không cần sửa backend; `PhieuGiaoCaModal` giữ nguyên các key này khi lưu phiếu giao ca.
- **Bảng 3 Hàng lỗi hỏng:** tên lỗi + số lượng (kg).
- **Bảng 4 Bàn giao ca sau (Nhựa Bàn Giao Ca Sau):** loại nhựa tự fill theo NVL cối mẫu. Cột **Nhập Trong Ngày** (trường `lay_trong_kho`) tự động lấy từ phiếu xuất kho NVL theo ngày - máy - ca. Cột **Nhập Ca Trước** (trường `ton_dau_ca`) **để trống — KHÔNG tự fill, KHÔNG tự tính lùi**; khối **Chọn ca trước** có Ngày (`SoTronDatePicker`) + Ca + nút **Đồng bộ** bên cạnh, **ăn theo Ngày + Ca + Máy ở mục 1 phía trên** (mặc định = ô ca trước logic `prevSlotLogic`, đổi mục 1 thì reset). Bấm mới fill `tồn cuối (ton_cuoi_ca)` của **ĐÚNG ô ngày + ca đã chọn của đúng máy** (khớp `(ngay, ca)` chuẩn hóa, bỏ qua phiếu đang sửa; thiếu phiếu thì để trống + báo, không lùi về quá khứ). **Đã bỏ icon (!)** ở header cột + bỏ dòng hiển thị `Ca trước / Ca sau logic` và `Ô ca trước chưa có phiếu — Nhập Ca Trước đang trống` (chỉ hiện note kết quả sau khi bấm Đồng bộ). `tổng_sử_dụng` = Σ bảng 1 theo mã NVL. `tồn_cuối = Nhập Trong Ngày + Nhập Ca Trước − tổng_sử_dụng`.
- **Phiếu giao ca (Nhật ký sản xuất):** Thao tác in phiếu giao ca trực tiếp từ danh sách (`/danh-sach-so-tron`) hoặc panel (`/so-tron`). Số trên bản in hiện đủ, không dấu `...` và không dấu chấm hàng nghìn/thập phân (thập phân dùng dấu phẩy, ví dụ `1234,568`). Thiết kế chuẩn 2 trang theo form thực tế (ảnh 1: Vật tư, ảnh 2: Thành phẩm/Lỗi/Sự cố/Chữ ký), cho phép xem & sửa trước khi in, nút Lưu, Lưu & In, In. **Thành phẩm trên phiếu giao ca chỉ xem** (sửa tại sổ trộn). Cột **Định mức vật tư** = Tổng trọng lượng kg của từng NVL trên phiếu trộn định mức của lệnh SX (NVL chính lấy `tong_khoi_luong`, fallback `% Tổng SL × tổng trọng lượng SP`; NVL phụ lấy `tong_khoi_luong`; nhiều bản tỷ lệ chỉ lấy bản mới nhất). Dòng NVL phụ chưa có trong sổ được thêm vào danh sách in/xem. Font xem phiếu: Times New Roman. Trang in A4 dọc: ô danh sách rộng hơn một chút và cao cố định; phần còn trống của mục I và II được chèn thêm dòng ô trắng để kín trang. Bốn chữ ký ưu tiên chân trang 2 và luôn nằm cùng một trang — nếu II tràn thì cả khối ký chuyển sang trang sau. Cột Màng trên sổ trộn chỉ hiển thị (tự tra), không chọn/sửa tay. Nhựa Bàn Giao Ca Sau: phiếu đã lưu không bị effect xuất kho/ca trước ghi đè; giữ dòng đã lưu dù không còn trong cối mẫu.

## Quy ước UI bắt buộc (không được tái phạm)

- **CHỈ có nút `In phiếu giao ca` — đã BỎ nút `In A4` (theo yêu cầu), không tự ý thêm lại:**
  - Form nhập (`SoTronPanel` tab form, chân trang): chỉ `Lưu/Cập nhật` + `In phiếu giao ca` (dựng snapshot `SoTronSavedReport` → `PhieuGiaoCaModal` → `printPhieuGiaoCaSlip`, 2 trang A4 dọc) + `Phiếu mới`.
  - Từng dòng danh sách (tab Danh sách trong panel + `SoTronListView` ở `/danh-sach-so-tron`): chỉ `In phiếu giao ca` (→ `setPreviewPhieuGiaoCaReport`/`setSelectedPhieuGiaoCa`) + `Sửa` + `Xóa`.
- **Cột Thao tác KHÔNG dùng menu three-dots:** dùng `SoTronRowActions` — 4 nút inline `In A4` / `In phiếu giao ca` / `Sửa` / `Xóa`, `flex flex-wrap justify-end gap-1.5` + `whitespace-nowrap`; bảng `min-w-[980px]`, cột Thao tác `w-[300px]` để không chen lấn.
- **Bộ lọc danh sách (date-gated):** Vào trang danh sách KHÔNG hiển thị gì — chỉ khi chọn ngày mới hiện phiếu của ngày đó (lọc thêm theo Máy/Ca trên kết quả của ngày). Ô ngày là **`SoTronDatePicker`** nhãn `Chọn Ngày:` (lịch popup 1 nút, hiển thị DD/MM/YYYY). **Không dùng 3 ô Ngày/Tháng/Năm rời** (`VnDatePicker`). **Không có ô Tìm từ khóa** (đã bỏ theo yêu cầu). **Không hiển thị số lượng bản ghi** (đã bỏ badge đếm ở tab Danh sách và `X phiếu` ở dòng trạng thái theo yêu cầu). Dòng trạng thái: chưa chọn ngày → `Chọn ngày để xem danh sách sổ trộn`; đã chọn → `Ngày DD/MM/YYYY`; rỗng → `Vui lòng chọn ngày…` / `Ngày … chưa có sổ trộn nào phù hợp.` Nút `Xóa bộ lọc` chỉ xóa Máy/Ca (giữ ngày); nút `Xóa` trong lịch để xóa ngày.
- **Danh sách tải nền:** `SoTronListView.load()` tải `/api/so-tron` trước rồi mới tải danh mục máy/ca riêng (lỗi danh mục không được làm trắng/trắng trang).

## Chống kẹt cache khi đổi UI (đã từng khiến nút `In A4` không hiện dù code đã có)

- Nguyên nhân đã gặp: `public/sw.js` cache-first mọi request + `VERSION` cứng → trình duyệt giữ `index.html`/bundle cũ mãi, người dùng không thấy nút mới.
- Quy tắc: `sw.js` dùng network-first cho navigation (`req.mode === 'navigate'`) để `index.html` luôn mới (bundle JS/CSS có hash nên cache-first vẫn an toàn); **mỗi bản build có đổi giao diện phải đổi `VERSION`** trong `public/sw.js` để xóa cache cũ.
- Sau build (`npm run build`), kiểm tra `dist/assets/*.js` mới nhất có chứa chuỗi UI mới (vd đếm `In A4`) và `dist/sw.js` đã lên VERSION mới; dặn người dùng hard-reload (Ctrl+F5) 1–2 lần nếu vẫn thấy giao diện cũ.

## Liên kết

`lenh_sx`, `bang_tron_vat_tu_dinh_muc`, `phan_cong_nhan_su_chi_tiet`, `danh_sach_may`, `cai_dat_thoi_gian`
