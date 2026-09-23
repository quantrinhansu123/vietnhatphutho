# phieu_xuat_kho

| | |
|---|---|
| **Bảng** | `phieu_xuat_kho` (tách từ `phieu_xuat_nhap_kho`) |
| **Tab** | `warehouse-slip`, `warehouse-history` (dùng chung panel, lọc xuất) |
| **DB** | Chính — label `he-thong` |
| **SQL** | `supabase-phieu-xuat-kho.sql` + `supabase-phieu-nhap-xuat-split-backfill.sql` |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/phieu-xuat-kho` | `handleWarehouseList` forced `xuat` |
| POST | `/api/phieu-xuat-kho` | `handleWarehouseCreate` forced `xuat` (validate lô NVL, link PTĐM) |
| PUT | `/api/phieu-xuat-kho/:slipCode` | `handleWarehouseUpdate` forced `xuat` + snapshot `phieu_xuat_nhap_kho_lich_su` |
| DELETE | `/api/phieu-xuat-kho/slip/:slipCode`, `/api/phieu-xuat-kho/:id` | Xóa xuyên bảng |
| GET | `/api/phieu-xuat-kho/dinh-muc-da-xuat`, `/lo-ton`, `/gia-tb-nhap`, `/:slipCode/lich-su` | Alias sub-endpoint |

## Frontend

`src/features/phieu-xuat-kho/api.ts` (client) — panel vẫn dùng `src/features/phieu-xuat-nhap-kho/index.tsx` qua facade `/api/phieu-xuat-nhap-kho` cho tới khi tách UI.

## Ghi chú tách bảng

- `id_dong_nhap_nguon` tham chiếu liên bảng sang `phieu_nhap_kho(id)` (backfill giữ `id`).
- Bảng link PTĐM (`phieu_xuat_nhap_kho_lenh_sx`) và lịch sử (`phieu_xuat_nhap_kho_lich_su`) vẫn dùng chung theo `ma_phieu`.
