# phieu_can_dinh_ki

| | |
|---|---|
| **Bảng** | `phieu_can_dinh_ki` |
| **Tab** | `weighing-summary` → `/tong-hop-ca` |
| **SQL** | `supabase-phieu-can-dinh-ki.sql` |
| **DB** | Riêng — label `phieu-can` (`SUPABASE_WEIGHING_*`, project `njdlkyxdieefeebcyaov`). Không dùng DB `he-thong`. |

## Env (phân biệt 2 DB)

| Label | Biến | Dùng cho |
|-------|------|----------|
| `he-thong` | `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Hệ thống còn lại |
| `phieu-can` | `SUPABASE_WEIGHING_URL` / `SUPABASE_WEIGHING_SERVICE_KEY` (+ publishable/anon) | Chỉ `/api/phieu-can-dinh-ki` |

## API (`server.ts`)

| Path | Dòng |
|------|------|
| `/api/phieu-can-dinh-ki/*` | ~7918 (`registerWeighingSlipRoutes`, client `supabaseWeighing`) |

## Frontend

| File | Nội dung |
|------|----------|
| `src/components/WeighingShiftSummary.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Rule Cursor

`.cursor/rules/weighing-image-preview.mdc` — ảnh phải mở modal, không tab mới.
