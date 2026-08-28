# bang_tron_vat_tu_dinh_muc

| **Bảng** | `bang_tron_vat_tu_dinh_muc` |
| **Tab** | `/danh-sach-bao-cao-phoi-tron` → **Phiếu trộn định mức** |
| **SQL** | `supabase-bang-tron-vat-tu-dinh-muc.sql` |

**API:** `/api/bang-tron-vat-tu-dinh-muc`  
Query: `ngay`, `ca`, `q`  
**UI:** `MixingNormMaterialsTab.tsx` · in: `MixingNormRatioPrintSheet.tsx`  
Gợi ý sang form phối trộn: `MixingReportForm.tsx` + `utils/mixingNormSuggestion.ts`

**Lưu ý (2026-08-26):** Theo nghiệp vụ, 1 lệnh SX chỉ có đúng 1 phiếu trộn định mức, kể cả khi lệnh SX chạy nhiều ngày
(quan hệ 1-1 theo `ma_lenh_sx`, không theo ngày). Đã triển khai:
- Form tạo (`MixingNormMaterialsTab.tsx`) **bỏ ô chọn Ngày** — `ngay` giờ chỉ còn là ngày tạo phiếu (tự set, không sửa được), không còn ý nghĩa nghiệp vụ theo ngày sản xuất.
- Validate chặn tạo 2 phiếu cho cùng `ma_lenh_sx`: client-side (so khớp `rows` đang có trước khi lưu) + server-side (`checkDuplicateMixingNormOrder` trong `server.ts`, chạy trong cả POST và PATCH `/api/bang-tron-vat-tu-dinh-muc`).
- "Nhân bản" (`openCopy`) bỏ trống `ma_lenh_sx` của bản sao, buộc chọn lệnh SX khác (vì bản gốc đã "chiếm" mã lệnh SX cũ).
- Picker "Mã đơn hàng / Lệnh SX" ở phiếu xuất kho NVL (`src/features/phieu-xuat-nhap-kho/index.tsx`) tra định mức chỉ bằng `ma_lenh_sx` (không còn gửi `ngay`).
- **Phiếu trộn thực tế** (`ActualMixingSheetTab.tsx`, bảng `phieu_tron_thuc_te`) đã đổi picker từ lọc-theo-ngày sang tìm-theo-mã-lệnh-SX (`SearchableSelect`); ô "Ngày" trên màn đó giờ là **ngày thực hiện trộn thực tế** (độc lập với `ngay` của phiếu định mức, gửi thẳng lên khi lưu) — xem `docs/ai-tables/phieu_tron_thuc_te.md`.

## Mô hình

**1 form nhập = 1 dòng DB = 1 phiếu**

- `ma_lenh_sx`, `ngay`, `ca`, `ghi_chu`
- Mỗi SP lưu thêm `so_luong_goc`, `ty_le_hao_hut`, `tong_trong_luong`, `dinh_luong_coi`, `so_lan_tron`.
- `tong_trong_luong = so_luong_goc × (1 + ty_le_hao_hut / 100)` — % hàng hỏng cộng thêm vào SL quy đổi trước hao hụt (mặc định lấy từ `san_pham.ty_le_hao_hut`), không phải trừ đi.
- Form chỉ nhập **1 công thức "cối trộn tiêu chuẩn"** cho mỗi SP (không còn nhập riêng từng "Lần trộn N"); `so_lan_tron = ceil(tong_trong_luong / dinh_luong_coi)` chỉ mang tính thông tin. Khi lưu, hệ thống tự nhân bản công thức này thành `so_lan_tron` phần tử trong `lan_tron` (cối cuối lấy phần khối lượng còn lại) để tương thích với Phiếu trộn thực tế (`phieu_tron_thuc_te`), vốn cần theo dõi thực tế theo từng cối.
- `chi_tiet` jsonb = mảng sản phẩm:

```json
[{
  "ma_sp": "...",
  "ten_sp": "...",
  "tong_trong_luong": 1000,
  "dinh_luong_coi": 500,
  "so_lan_tron": 2,
  "nvl": [{ "ma_nvl", "ten_nvl", "ten_nvl_san_xuat", "gia_tri", "don_vi", "khoi_luong", "ty_le_coi", "ty_le_tong", "tong_khoi_luong" }]
}]
```

`khoi_luong` (kg, cho 1 cối): nếu `don_vi = %` → `dinh_luong_coi × gia_tri / 100`; nếu `kg` → bằng `gia_tri`.
`ty_le_coi` (%) = `gia_tri (kg) / dinh_luong_coi × 100`. `ty_le_tong` giữ nguyên bằng `ty_le_coi` vì tỷ lệ phối trộn không đổi theo mẻ. `tong_khoi_luong` (kg, cho cả SP) = `ty_le_tong / 100 × tong_trong_luong`.

`ten_sp` là ô nhập tự do, **không tự động điền** từ catalog dù chọn 1 hay nhiều mã SP — người dùng luôn phải tự gõ tên hiển thị cho công nhân trộn.

**Ô "Mã sản phẩm" trong mỗi dòng SP là multi-select, hiển thị `ma_amis — ten_san_xuat`** — 1 dòng SP (1 công thức "cối trộn tiêu chuẩn") có thể gán cho nhiều mã SP cùng lúc (`ma_sp` lưu dạng chuỗi nối bằng dấu phẩy, ví dụ `"A, B"`). Khi chọn ≥ 2 mã SP cho cùng 1 dòng: NVL trùng tên/mã giữa các SP được gộp lại chỉ lấy 1 dòng NVL (không nhân đôi), nhưng **giá trị (kg/%) không tự động điền** — người dùng phải tự nhập vì mỗi SP có định mức gốc khác nhau; chỉ khi 1 dòng chỉ có đúng 1 mã SP thì giá trị NVL mới tự fill từ `san_pham.npl_phan_tram` như bình thường.

Danh sách hiển thị **1 dòng / phiếu** (nhiều SP gộp trong phiếu). Modal lớn lặp danh sách NVL từ `san_pham.npl_phan_tram` theo cối tiêu chuẩn. In A4 ngang: phiếu định mức in 1 bảng cối tiêu chuẩn/SP (kèm dòng "Tổng trọng lượng NVL cần"); phiếu thực tế (`isActual`) vẫn in theo từng lần trộn, tối đa 6 lần trộn mỗi bảng.

**NVL phụ theo từng sản phẩm** độc lập với danh sách công thức trộn: chọn lệnh SX thì tự fill **1 dòng / SP** theo sản phẩm trên lệnh. Thêm, xóa hoặc chọn nhiều mã SP ở phần công thức **không** thêm/bớt dòng NVL phụ. Lưu vào `nvl_phu` trên từng block SP (SP không nằm trong công thức được lưu thêm block `loai: "nvl_phu"` để phiếu xuất kho vẫn cộng NVL phụ).
