# bang_tron_vat_tu_dinh_muc

| **Bảng** | `bang_tron_vat_tu_dinh_muc` |
| **Tab** | `/danh-sach-bao-cao-phoi-tron` → **Phiếu trộn định mức** |
| **SQL** | `supabase-bang-tron-vat-tu-dinh-muc.sql`, `supabase-bang-tron-vat-tu-dinh-muc-ngay-bat-buoc.sql`, `supabase-bang-tron-vat-tu-dinh-muc-ten-phieu.sql`, `supabase-bang-tron-vat-tu-dinh-muc-lich-su.sql`, `supabase-bang-tron-vat-tu-dinh-muc-may.sql` (cột `may`) |

**API:** `/api/bang-tron-vat-tu-dinh-muc`  
Query: `ngay`, `ca`, `q`  
**UI:** `MixingNormMaterialsTab.tsx` · in: `MixingNormRatioPrintSheet.tsx`  
Gợi ý sang form phối trộn: `MixingReportForm.tsx` + `utils/mixingNormSuggestion.ts` (phiếu không ca khớp theo ngày)

**Nghiệp vụ hiện tại:**
- **Nhiều lệnh SX / 1 phiếu:** ô Lệnh SX là select2 chọn nhiều (`SearchableMultiSelect`); các lệnh phải **cùng máy** (lọc options + validate khi lưu, đổi máy sẽ bỏ lệnh khác máy). `ma_lenh_sx` lưu text nối bằng dấu phẩy (vd `"LSX-001, LSX-002"`); API khớp token khi lọc nên tương thích ngược.
- **Bỏ ô Ca / Ngày / Ghi chú chung:** ngày phiếu tự điền (hôm nay khi tạo, giữ ngày cũ khi sửa); `ca` lưu `null`; ghi chú chung giữ lại khi sửa, phiếu mới để trống. Server không còn bắt buộc `ca`.
- **Máy phiếu:** ô Máy (select2, bắt buộc) mặc định theo máy chung các lệnh; tên máy in cạnh tiêu đề (`Máy: X` sau Tên phiếu) và có trong `ten_phieu` (`PTĐM - ngày - Máy - LSX`). Cột `may` (migration `...-may.sql`).
- **Trạng thái theo lệnh SX:** cột Trạng thái trên list suy từ lệnh liên quan (tất cả xong → Hoàn thành; có Đang sx → Đang sx; còn lại Chờ sx). Lệnh `Hoàn thành`/`Hủy` ẩn khỏi ô chọn lệnh, **chặn tạo PTĐM mới** (client + `POST` server tra `lenh_sx.trang_thai`), và phiếu của lệnh đã xong ẩn khỏi picker xuất kho NVL.
- Một `ma_lenh_sx` có thể có nhiều phiếu trộn định mức; không chặn trùng theo mã lệnh.
- Khi sửa làm thay đổi trọng lượng NVL chính/phụ, FE gửi `tao_lich_su: true`; API tạo dòng mới, giữ dòng cũ và gán `id_phieu_tron_dm_ban_dau` thẳng về phiếu gốc. Tên bản mới có hậu tố ` - tỷ lệ N`. Sửa metadata khác cập nhật tại chỗ.
- `ngay` là ô nhập bắt buộc trên form và cột `bang_tron_vat_tu_dinh_muc.ngay` là `NOT NULL`.
- Nhân bản phiếu giữ lại `ma_lenh_sx`, người dùng chọn ngày cho phiếu mới.
- Phiếu xuất kho NVL tra định mức theo từng phiếu (`dinh_muc_id`), ẩn phiếu đã xuất và phiếu của lệnh đã xong.
- Picker phiếu trộn thực tế hiển thị cả mã lệnh, ngày định mức và ca để phân biệt các phiếu.

## Mô hình

**1 form nhập = 1 dòng DB = 1 phiếu**

- `ten_phieu`: Tự động ghép theo quy tắc `PTĐM + ngày + ca + lệnh sản xuất` (ví dụ: `PTĐM - 2026-09-08 - Ca 1 - LSX-001`).
- `ma_lenh_sx`, `ngay`, `ca`, `ghi_chu`
- **Memory nghiệp vụ:** Khi chọn lệnh SX, form chỉ tạo **1 block công thức** và nạp toàn bộ sản phẩm của lệnh vào danh sách options của ô multi-select **Sản phẩm**; **không tự động chọn chip nào**. Người dùng tự chọn các sản phẩm trong cùng ô, không tạo mỗi sản phẩm thành một block/dòng riêng. Các dòng cùng `san_pham_id` chỉ hiện 1 chip và được cộng tổng trọng lượng quy đổi trước khi tính hao hụt; khác `san_pham_id` vẫn là các chip riêng trong cùng ô.
- Chip/label SP và phiếu in dùng **`ten_ghep`** (không hiện raw `ten_san_xuat`). Sau khi chọn SP, khối **Hao hụt theo sản phẩm** tự hiện `Tổng sản phẩm: n Cuộn, n Tấm` theo ĐVT trên lệnh SX.
- Mỗi SP lưu thêm `so_luong_goc`, `ty_le_hao_hut`, `tong_trong_luong`, `dinh_luong_coi`, `so_lan_tron`, `ten_ghep`.
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
`ty_le_coi` (%) = `gia_tri (kg) / dinh_luong_coi × 100`. `ty_le_tong` giữ nguyên bằng `ty_le_coi` vì tỷ lệ phối trộn không đổi theo mẻ. `tong_khoi_luong` (kg, cho cả SP) = `ty_le_tong / 100 × tong_trong_luong`, được làm tròn tối đa 2 chữ số thập phân ngay trên form thêm/sửa và khi lưu.

`ten_sp` là ô nhập tự do, **không tự động điền** từ catalog dù chọn 1 hay nhiều mã SP — người dùng luôn phải tự gõ tên hiển thị cho công nhân trộn.

Trong danh sách NVL của form thêm/sửa, ô chọn mã + tên NVL tìm được theo mã, tên và tên NVL sản xuất; ô **Tên NVL sản xuất** là searchable select được lọc theo mã và tên NVL đang chọn, đồng thời cho phép nhập tùy chỉnh.

**Ô "Mã sản phẩm" trong mỗi dòng SP là multi-select, hiển thị `ma_amis — ten_san_xuat`** — 1 dòng SP (1 công thức "cối trộn tiêu chuẩn") có thể gán cho nhiều mã SP cùng lúc (`ma_sp` lưu dạng chuỗi nối bằng dấu phẩy, ví dụ `"A, B"`). **NVL chính không tự điền** khi chọn mã SP (không lấy từ `san_pham.npl_phan_tram`); người dùng tự bấm “Thêm NVL chính”. Đổi/thêm/bớt mã SP trên cùng 1 dòng **không xóa** NVL chính đã nhập.

Danh sách hiển thị **1 dòng / phiếu** (nhiều SP gộp trong phiếu). In A4 ngang: phiếu định mức in 1 bảng cối tiêu chuẩn/SP (kèm dòng "Tổng trọng lượng NVL cần"); cột tổng trọng lượng của NVL chính và tổng cuối bảng được làm tròn tối đa 2 chữ số thập phân. Tiêu đề mỗi khối SP: chỉ tên hiển thị cho CN (`ten_sp`, chữ xanh), không dòng phụ Mã SP/`ten_ghep`; phiếu thực tế (`isActual`) vẫn in theo từng lần trộn, tối đa 6 lần trộn mỗi bảng và giữ dòng tên kỹ thuật.

**NVL phụ** nhập giống NVL chính: bấm **Thêm sản phẩm** → **tự điền + chọn các SP đã chọn ở block sản phẩm chính cùng vị trí** (block phụ #N lấy SP của block chính #N, có thể sửa lại; bỏ qua mã đã dùng ở block phụ khác để không trùng khi lưu), rồi **Thêm NVL phụ**. Không tự fill theo lệnh SX. Tổng Cuộn/Tấm (theo lệnh SX) hiển thị theo từng block phụ và tổng toàn danh sách NVL phụ. Lưu thành block `loai: "nvl_phu"` (`ma_sp` nối bằng dấu phẩy). Trùng mã SP chỉ chặn **trong** NVL chính hoặc **trong** NVL phụ — cùng mã ở cả hai phần là hợp lệ. Phiếu cũ gắn `nvl_phu` trên từng SP công thức vẫn mở được; nhóm các SP cùng danh sách NVL phụ thành 1 block.

`nvl_phu[].don_vi` luôn lấy từ đơn vị chính `kho_nvl.don_vi` của NVL đã chọn; API tra lại danh mục trước khi lưu để không nhận đơn vị sai từ client/dữ liệu cũ.
Mỗi dòng NVL lưu kèm `material_id` trong JSON để phiếu xuất kho gộp đúng theo ID danh mục; API tra lại `kho_nvl.id` và bổ sung ID cho payload mới.

Khối lượng NVL phụ là **tổng trọng lượng (kg)** dùng cho toàn bộ SP, không có `% Cối trộn` và không có `Giá trị (kg/cối)`. Khi lưu, `gia_tri`, `khoi_luong` và `tong_khoi_luong` cùng mang giá trị tổng này; các trường tỷ lệ để `null`. Trên phiếu in, **toàn bộ NVL chính in trước**, rồi mới tới khối **Nguyên liệu phụ** (kể cả phiếu cũ gắn `nvl_phu` trên từng SP công thức). Bảng NVL phụ bỏ hẳn hai cột `% Cối trộn`, `Giá trị (kg/cối)`.

**Lưu ý san_pham_id (Quy tắc quan trọng):**
- Mỗi block sản phẩm (NVL chính & NVL phụ) **BẮT BUỘC** phải gắn `san_pham_id` hợp lệ.
- Hệ thống tự động dùng `resolveValidProductIds` để truy vết ID sản phẩm chuẩn từ `catalogProducts` / `selectedOrder` nếu `maSpIds` bị khuyết.
- Khi lưu, payload gửi backend luôn đảm bảo: `san_pham_id = validIds[0]` (không gửi chuỗi rỗng `""`) và `san_pham_ids = validIds` nếu chọn nhiều SP gộp. Nguồn validate client sẽ chặn và báo lỗi nếu sản phẩm hoàn toàn không có `san_pham_id` hợp lệ.
