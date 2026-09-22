# phieu_xuat_nhap_kho

| | |
|---|---|
| **Bảng** | `phieu_xuat_nhap_kho` |
| **Tab** | `warehouse-slip`, `warehouse-history` |
| **SQL** | `supabase-phieu-xuat-nhap-kho.sql` (gồm cột `may`, `phan_loai_nvl`, `trong_luong_kg`, `nhom_vthh`) + migrate `supabase-phieu-xuat-nhap-kho-*.sql` (gồm `…-lo-ton.sql`, `…-lenh-sx.sql`, `…-phan-loai-may.sql`, `…-trong-luong-kg.sql`, `…-nhom-vthh.sql`, `…-ton-dau-ca-may.sql`, `…-lich-su.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/phieu-xuat-nhap-kho` | ~5212 |
| GET | `/api/phieu-xuat-nhap-kho/lo-ton` | (lô tồn theo `ma_npl`) |
| GET | `/api/phieu-xuat-nhap-kho/gia-tb-nhap` | (giá BQ nhập theo mã NVL + tháng) |
| GET | `/api/phieu-xuat-nhap-kho/dinh-muc-da-xuat` | tập phiếu trộn định mức đã xuất (`dinh_muc_id`, `ten_phieu`) — có `ma_phieu` thì lọc theo 1 phiếu xuất kho |
| POST | `/api/phieu-xuat-nhap-kho` | ~5263 |
| PUT | `/api/phieu-xuat-nhap-kho/:slipCode` | ~5377 — với phiếu xuất kho NVL thì lưu 1 row snapshot cũ/mới vào `phieu_xuat_nhap_kho_lich_su` |
| GET | `/api/phieu-xuat-nhap-kho/:slipCode/lich-su` | danh sách lần sửa của 1 phiếu (mới nhất trước) |
| DELETE | slip / id | ~5495+ |

### Liên kết phiếu trộn định mức

Bảng phụ `phieu_xuat_nhap_kho_lenh_sx` giữ tên cũ để tương thích, nhưng luồng **xuất kho NVL** liên kết trực tiếp bằng `dinh_muc_id` và lưu kèm `ten_phieu`.
Picker tải từ `bang_tron_vat_tu_dinh_muc`, hiển thị tên PTĐM (`ten_phieu` dạng `PTĐM - tên máy - mã lệnh`, nhiều mã nối ` - `), không sinh lựa chọn từ lệnh sản xuất. Một lệnh SX có nhiều phiếu định mức vẫn chọn/xuất độc lập; cho phép tạo nhiều phiếu xuất từ cùng 1 PTĐM.
PTĐM chỉ ẩn khỏi picker khi tất cả lệnh SX trong đó đã `Hoàn thành`/`Hủy`; không còn ẩn theo "đã xuất".
Chi tiết NVL được đọc trực tiếp từ JSON `chi_tiet` của các phiếu định mức đã chọn. Màn hình nhập **chia nhóm NVL chính / NVL phụ** (header + tổng TL từng nhóm); nút **Thêm NVL chính** / **Thêm NVL phụ** thêm dòng trống đúng phân loại. Combobox mã lọc theo `phan_loai` danh mục kho NVL.
Mỗi dòng lưu `may` và `phan_loai_nvl` (`nvl_chinh`, `nvl_phu`, `chua_phan_loai`) chỉ để bản in và luồng in lại từ lịch sử giữ đúng nhóm. Phiếu cũ không suy luận ngược: để máy trống và backfill `chua_phan_loai`.
Cột `phan_loai_nvl` không dùng CHECK constraint trong database; các file SQL chủ động gỡ constraint `phieu_xuat_nhap_kho_phan_loai_nvl_check` nếu database cũ đã có.
Payload lưu dòng NVL gửi đồng thời `materialClass`, `warehouseClass` và `phan_loai_nvl`; server ưu tiên `phan_loai_nvl` để bảo toàn đúng `nvl_chinh`, `nvl_phu` hoặc `chua_phan_loai` từ phiếu trộn định mức.
Với NVL phụ, `gia_tri` trên phiếu trộn là SL theo ĐVT gốc và `tong_khoi_luong` là kg đã quy đổi. Phiếu xuất kho dùng `gia_tri` cho **SL CT** và hệ số `tong_khoi_luong / gia_tri` để tính **Quy đổi kg** khi nhập SL thực.
Trọng lượng quy đổi được lưu tại `trong_luong_kg` (cả NVL chính: lấy kg/đơn vị từ định mức, lẫn NVL phụ). Bảng NVL chính và NVL phụ trên mẫu in/in lại đều có cột **Trọng lượng (kg)** và dòng tổng kg riêng; cuối phiếu in (nhiều máy) thêm **TỔNG TL NVL CHÍNH TOÀN PHIẾU** và **TỔNG TL NVL PHỤ TOÀN PHIẾU**. Màn lập phiếu và chi tiết lịch sử hiển thị tổng TL chính/phụ riêng.
Khi nạp nhiều dòng NVL phụ, hệ thống gộp và cộng SL định mức/thực xuất/trọng lượng theo cùng máy + cùng tên (+mã khi tên trống) + cùng ĐVT + cùng giá. Riêng **Băng Dính** và **Tem** chỉ gộp khi đồng thời trùng `nhom_vthh`; các NVL phụ khác không tách theo VTHH. Dữ liệu cũ thiếu ID dùng mã/tên làm khóa dự phòng.
Danh sách **Chi tiết NVL** có cột **Tên sản xuất** (read-only), ưu tiên tên trên phiếu định mức rồi đối chiếu `kho_nvl.ten_nvl_sx` theo mã NPL; không còn dòng chữ phụ `Tên SX: …` dưới cột tên.
Bản in phiếu xuất NVL tách mỗi máy thành một trang; trong mỗi trang in riêng bảng NVL chính, NVL phụ và Chưa phân loại nếu có dữ liệu. Cuối bản in luôn có 1 trang **TỔNG HỢP** gộp dòng toàn bộ máy/ca (cùng tên + cùng ĐVT + cùng giá; Băng Dính/Tem trùng thêm VTHH) với 2 bảng riêng và 2 tổng **TỔNG TL NVL CHÍNH TOÀN PHIẾU** / **TỔNG TL NVL PHỤ TOÀN PHIẾU**. Màn nhập hiển thị tổng TL ngay tại header nhóm NVL chính/phụ và hộp tổng cuối bảng.
Mỗi dòng NVL xuất có thêm **Ngày tồn**, **Ca trước** và **Tồn đầu ca** (`ton_dau_ca_may`). Ngày/Ca chọn **theo từng dòng**; tồn đầu ca = tồn cuối sổ trộn đúng ô ngày+ca đó + máy ở trên. Mặc định = ca trước logic của ca form. Vẫn cho sửa tay.
Mỗi lần **sửa** phiếu xuất kho NVL (PUT) lưu 1 row vào `phieu_xuat_nhap_kho_lich_su` gồm người sửa + snapshot toàn bộ dòng cũ/mới (best-effort, không chặn lưu phiếu nếu chưa chạy migration). Nút **Lịch sử thay đổi** (icon History) có ở: menu thao tác từng phiếu xuất NVL + modal chi tiết phiếu trong `warehouse-history`, và khi đang sửa phiếu xuất NVL trong `warehouse-slip`. Modal hiển thị từng lần sửa (mới nhất trước): thời gian, người sửa, thông tin phiếu đổi + diff dòng (thêm/xóa/sửa Tồn đầu ca, SL CT, SL thực, giá, thành tiền...).

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/phieu-xuat-nhap-kho/index.tsx` | Panel / logic chính (**UI feature/module-kho**: Tên kho, Xuất kho treo…; **logic xuất NVL giống main**: PTĐM + `mergeNormMaterialLines` + Tồn đầu ca từ sổ trộn) |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |
| `src/utils/soTronPrevShiftTon.ts` | Tồn đầu ca = tồn cuối ca trước logic (`bang_ban_giao.ton_cuoi_ca`) |

**UI:** Form feature (Tên kho / treo / lịch sử…) + khi **Xuất kho NVL** dùng luồng main: Ca checkbox multi (cùng `loai_ca`) · PTĐM tick điền NVL · cột Ngày tồn / Ca trước / Tồn đầu ca / SL CT / SL thực · Tên sản xuất NVL read-only theo dòng · giá BQ nhập. Tick PTĐM → `mergeNormMaterialLines`. Tồn đầu ca = tồn cuối sổ trộn theo **Ngày tồn + Ca trước của từng dòng** (mặc định = ca trước logic của ca form) + Máy.

## Logic phiếu NVL (`nvlSlipLogic.ts`)

- SQL migrate: `supabase-phieu-xuat-nhap-kho-module1.sql` — thêm `dia_diem, loai_nhap_kho, ten_nvl_sx, ca_list`.
- Server (`server.ts`): `parseWarehouseSlipBody` + `buildWarehouseSlipInsertRecords` lưu 6 cột mới (insert tương thích DB cũ qua `insertWarehouseSlipRecordsResilient`); nhập NVL không cần máy, xuất NVL máy bắt buộc; `GET /api/ton-kho-nvl` báo cáo tồn NVL hard `Tồn đầu = 0`, `Tồn cuối = Nhập − Xuất`.
- Pure logic: `src/features/phieu-xuat-nhap-kho/nvlSlipLogic.ts` (+ unit `tests/unit/nvlSlipLogic.test.ts`).
- UI (`src/features/phieu-xuat-nhap-kho/index.tsx`): `LOAI_NHAP_KHO_OPTIONS` (4 gợi ý + tự nhập), ô Máy ẩn với phiếu nhập thường (chỉ hiện khi Nhập lại VTSX / Tạo hạt), `validateShiftsSameLoaiCa`, tên SX NVL read-only theo dòng từ `kho_nvl` / PTĐM, nút **Thêm NVL chính/phụ** (chính trên · phụ dưới), xuất NVL có **Ngày tồn + Ca trước trên từng dòng** để lấy tồn đầu ca.


## Kho thành phẩm (chốt 22/09/2026)

- SQL: `supabase-nhap-kho.sql` + `supabase-phieu-xuat-nhap-kho-thanh-pham.sql` (`so_m2`, `so_m_dai`, `dia_chi`, `so_tron_ids`).
- Logic: `src/features/phieu-xuat-nhap-kho/thanhPham.ts` + `thanhPhamInbound.ts` (+ unit `tests/unit/thanhPham.test.ts`).
- API: `GET /api/nhap-kho?from=&to=` — danh sách từ `nhap_kho` (`thanh_pham`); tồn đầu/nhập/xuất từ phiếu NX. **Không** đọc/ghi `ton_kho_thanh_pham`.
- Ghi sổ SP: sau phiếu nhập TP → `nhap_kho` với `loai_kho='thanh_pham'` (xem [nhap_kho.md](./nhap_kho.md)).
- UI phiếu (`warehouseKind=san_pham`): **nhập** — Ngày phiếu riêng; khối viền vàng **Lọc lệnh sản xuất** (ngày lọc lệnh + chọn nhiều máy) → tick lệnh → nạp **mã SP + tên sản xuất (tên ghép)** + quy đổi **kg / m² / m dài**; ghi `nhap_kho` (`ma_sp`, `ten_sp` = tên ghép, quy đổi); **không dùng ca**. **Xuất** — trong **Chi tiết sản phẩm** mỗi dòng `SearchableSelect` chọn **1 SP** từ tồn (`/api/nhap-kho`); cột Mã · Tên · ĐVT · SL CT · SL thực · kg · m² · m dài · Giá · Thành tiền (**không** khối multi-select “Thêm từ tồn kho hệ thống”; **không dùng ca**).
- `/kho-hang` → Kho thành phẩm: `ThanhPhamStockPanel` gọi `/api/nhap-kho` (chọn từ–đến ngày mới hiện list).

## Script

`scripts/sync-kho-nvl-from-phieu.mjs` — đồng bộ tồn kho từ phiếu.
