# phieu_can_dinh_ki

| | |
|---|---|
| **Bảng** | `phieu_can_dinh_ki` |
| **Tab** | `weighing-summary` → `/tong-hop-ca` |
| **SQL** | `supabase-phieu-can-dinh-ki.sql` |
| **DB** | Chính — label `he-thong` (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY`). |

## Env

| Label | Biến | Dùng cho |
|-------|------|----------|
| `he-thong` | `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | `/api/phieu-can-dinh-ki` + hệ thống còn lại |
| `phieu-can` | `SUPABASE_WEIGHING_*` | `can_tu_dong`, `kiem_kho` (không dùng cho phiếu cân) |

## API (`server.ts`)

| Path | Dòng |
|------|------|
| `/api/phieu-can-dinh-ki/*` | `registerWeighingSlipRoutes`, client `supabase` (he-thong) |

## Frontend

| File | Nội dung |
|------|----------|
| `src/components/WeighingShiftSummary.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Rule Cursor

`.cursor/rules/weighing-image-preview.mdc` — ảnh phải mở modal, không tab mới.
