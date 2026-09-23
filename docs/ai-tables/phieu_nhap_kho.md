# phieu_nhap_kho

| | |
|---|---|
| **Bảng** | `phieu_nhap_kho` (tách từ `phieu_xuat_nhap_kho`) |
| **Tab** | `warehouse-slip`, `warehouse-history` (dùng chung panel, lọc nhập) |
| **DB** | Chính — label `he-thong` |
| **SQL** | `supabase-phieu-nhap-kho.sql` + `supabase-phieu-nhap-xuat-split-backfill.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/phieu-nhap-kho` | `handleWarehouseList` forced `nhap` |
| POST | `/api/phieu-nhap-kho` | `handleWarehouseCreate` forced `nhap` (ghi `nhap_kho` khi TP) |
| PUT | `/api/phieu-nhap-kho/:slipCode` | `handleWarehouseUpdate` forced `nhap`, cấm đổi loại |
| DELETE | `/api/phieu-nhap-kho/slip/:slipCode`, `/api/phieu-nhap-kho/:id` | Xóa xuyên bảng |
| GET | `/api/phieu-nhap-kho/gia-tb-nhap`, `/lo-ton`, `/:slipCode/lich-su` | Alias sub-endpoint |

## Frontend

`src/features/phieu-nhap-kho/api.ts` (client) — panel vẫn dùng `src/features/phieu-xuat-nhap-kho/index.tsx` qua facade `/api/phieu-xuat-nhap-kho` cho tới khi tách UI.

## Ghi chú tách bảng

- Backfill giữ nguyên `id` → đọc gộp dedupe theo `id` (`mergeWarehouseMovementRows`).
- Endpoint cũ `/api/phieu-xuat-nhap-kho` là facade đọc/ghi cả 2 bảng mới + bảng cũ.
