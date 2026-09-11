# phieu_xuat_nhap_kho

| | |
|---|---|
| **Bảng** | `phieu_xuat_nhap_kho` |
| **Tab** | `warehouse-slip`, `warehouse-history` |
| **SQL** | `supabase-phieu-xuat-nhap-kho.sql` + migrate `supabase-phieu-xuat-nhap-kho-*.sql` (gồm `supabase-phieu-xuat-nhap-kho-lo-ton.sql`, `supabase-phieu-xuat-nhap-kho-lenh-sx.sql`, `supabase-phieu-xuat-nhap-kho-phan-loai-may.sql`, `supabase-phieu-xuat-nhap-kho-trong-luong-kg.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/phieu-xuat-nhap-kho` | ~5212 |
| GET | `/api/phieu-xuat-nhap-kho/lo-ton` | (lô tồn theo `ma_npl`) |
| GET | `/api/phieu-xuat-nhap-kho/gia-tb-nhap` | (giá BQ nhập theo mã NVL + tháng) |
| GET | `/api/phieu-xuat-nhap-kho/dinh-muc-da-xuat` | tập phiếu trộn định mức đã xuất (`dinh_muc_id`, `ten_phieu`) — có `ma_phieu` thì lọc theo 1 phiếu xuất kho |
| POST | `/api/phieu-xuat-nhap-kho` | ~5263 |
| PUT | `/api/phieu-xuat-nhap-kho/:slipCode` | ~5377 |
| DELETE | slip / id | ~5495+ |

### Liên kết phiếu trộn định mức

Bảng phụ `phieu_xuat_nhap_kho_lenh_sx` giữ tên cũ để tương thích, nhưng luồng **xuất kho NVL** liên kết trực tiếp bằng `dinh_muc_id` và lưu kèm `ten_phieu`.
Picker tải từ `bang_tron_vat_tu_dinh_muc`, hiển thị `ten_phieu`, không sinh lựa chọn từ lệnh sản xuất. Một lệnh SX có nhiều phiếu định mức vẫn chọn/xuất độc lập.
Phiếu định mức đã gắn với phiếu xuất khác bị ẩn để tránh xuất trùng; khi sửa phiếu, các lựa chọn của chính phiếu đó được khôi phục.
Chi tiết NVL được đọc trực tiếp từ JSON `chi_tiet` của các phiếu định mức đã chọn. Màn hình nhập giữ cách chia nhóm NVL chính/NVL phụ như cũ, không chia nhóm hay hiển thị theo máy; lịch sử cũng không thêm cột máy/phân loại.
Mỗi dòng lưu `may` và `phan_loai_nvl` (`nvl_chinh`, `nvl_phu`, `chua_phan_loai`) chỉ để bản in và luồng in lại từ lịch sử giữ đúng nhóm. Phiếu cũ không suy luận ngược: để máy trống và backfill `chua_phan_loai`.
Cột `phan_loai_nvl` không dùng CHECK constraint trong database; các file SQL chủ động gỡ constraint `phieu_xuat_nhap_kho_phan_loai_nvl_check` nếu database cũ đã có.
Payload lưu dòng NVL gửi đồng thời `materialClass`, `warehouseClass` và `phan_loai_nvl`; server ưu tiên `phan_loai_nvl` để bảo toàn đúng `nvl_chinh`, `nvl_phu` hoặc `chua_phan_loai` từ phiếu trộn định mức.
Với NVL phụ, `gia_tri` trên phiếu trộn là SL theo ĐVT gốc và `tong_khoi_luong` là kg đã quy đổi. Phiếu xuất kho dùng `gia_tri` cho **SL CT** và hệ số `tong_khoi_luong / gia_tri` để tính **Quy đổi kg** khi nhập SL thực.
Trọng lượng quy đổi được lưu tại `trong_luong_kg` (cả NVL chính: lấy kg/đơn vị từ định mức, lẫn NVL phụ). Bảng NVL chính và NVL phụ trên mẫu in/in lại đều có cột **Trọng lượng (kg)** và dòng tổng kg riêng; cuối phiếu in (nhiều máy) thêm **TỔNG TL NVL CHÍNH TOÀN PHIẾU** và **TỔNG TL NVL PHỤ TOÀN PHIẾU**. Màn lập phiếu và chi tiết lịch sử hiển thị tổng TL chính/phụ riêng.
Khi nạp nhiều dòng NVL phụ, hệ thống gộp và cộng SL định mức/thực xuất/trọng lượng theo cùng máy + cùng tên (+mã khi tên trống) + cùng ĐVT + cùng giá. Riêng **Băng Dính** và **Tem** chỉ gộp khi đồng thời trùng `nhom_vthh`; các NVL phụ khác không tách theo VTHH. Dữ liệu cũ thiếu ID dùng mã/tên làm khóa dự phòng.
Danh sách **Chi tiết NVL** hiển thị thêm **Tên sản xuất**, ưu tiên tên trên phiếu định mức rồi đối chiếu `kho_nvl.ten_nvl_sx` theo mã NPL; trường tên sản xuất chỉ hiển thị, không tạo thêm cột lưu trữ trên phiếu.
Bản in phiếu xuất NVL tách mỗi máy thành một trang; trong mỗi trang in riêng bảng NVL chính, NVL phụ và Chưa phân loại nếu có dữ liệu. Cuối bản in luôn có 1 trang **TỔNG HỢP** gộp dòng toàn bộ máy/ca (cùng tên + cùng ĐVT + cùng giá; Băng Dính/Tem trùng thêm VTHH) với 2 bảng riêng và 2 tổng **TỔNG TL NVL CHÍNH TOÀN PHIẾU** / **TỔNG TL NVL PHỤ TOÀN PHIẾU**. Màn nhập hiển thị tổng TL ngay tại header nhóm NVL chính/phụ và hộp tổng cuối bảng.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/phieu-xuat-nhap-kho/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Script

`scripts/sync-kho-nvl-from-phieu.mjs` — đồng bộ tồn kho từ phiếu.
