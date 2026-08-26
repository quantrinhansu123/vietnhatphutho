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
| GET | `/api/phieu-xuat-nhap-kho/lenh-sx-da-xuat` | tập `{ma_lenh_sx, ngay, ca}` đã xuất — có `ma_phieu` thì lọc theo 1 phiếu |
| POST | `/api/phieu-xuat-nhap-kho` | ~5263 |
| PUT | `/api/phieu-xuat-nhap-kho/:slipCode` | ~5377 |
| DELETE | slip / id | ~5495+ |

### Bảng liên kết `phieu_xuat_nhap_kho_lenh_sx`

Bảng phụ (không có tab riêng) lưu lệnh SX (`ma_lenh_sx, ngay, ca`) đã chọn khi lập phiếu **xuất kho NVL** — 1 dòng / lệnh SX / phiếu.
Dùng để ẩn khỏi picker "Mã đơn hàng / Lệnh SX" các tổ hợp (mã lệnh SX, ngày, ca) đã có phiếu xuất, tránh xuất trùng.
Ghi/xóa đồng bộ với POST/PUT/DELETE phiếu (`replaceWarehouseLenhSxLinks`, `deleteWarehouseLenhSxLinks` trong `server.ts`).
Ngày trong picker được **tự sinh từ khoảng `ngay_bat_dau..ngay_ket_thuc`** của lệnh SX (hàm `expandWarehouseProductionOrderDates`,
tối đa 60 ngày) — không lấy từ `bang_tron_vat_tu_dinh_muc` nữa, vì phiếu trộn định mức đi 1-1 theo lệnh SX (không theo ngày).
Khi tra định mức NVL để điền SL CT, chỉ gửi `ma_lenh_sx` (bỏ `ngay`/`ca` khỏi query `/api/bang-tron-vat-tu-dinh-muc`).

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/phieu-xuat-nhap-kho/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Script

`scripts/sync-kho-nvl-from-phieu.mjs` — đồng bộ tồn kho từ phiếu.
