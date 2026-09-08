# phieu_xuat_nhap_kho

| | |
|---|---|
| **Bảng** | `phieu_xuat_nhap_kho` |
| **Tab** | `warehouse-slip`, `warehouse-history` |
| **SQL** | `supabase-phieu-xuat-nhap-kho.sql` + migrate `supabase-phieu-xuat-nhap-kho-*.sql` (gồm `supabase-phieu-xuat-nhap-kho-lo-ton.sql`, `supabase-phieu-xuat-nhap-kho-lenh-sx.sql`) |

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
Chi tiết NVL được đọc trực tiếp từ JSON `chi_tiet` của các phiếu định mức đã chọn và gộp theo mã NVL.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/phieu-xuat-nhap-kho/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Script

`scripts/sync-kho-nvl-from-phieu.mjs` — đồng bộ tồn kho từ phiếu.
