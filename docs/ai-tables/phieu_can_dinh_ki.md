# phieu_can_dinh_ki

| | |
|---|---|
| **Bảng** | `phieu_can_dinh_ki` |
| **Tab** | `weighing-summary` → `/tong-hop-ca` |
| **SQL** | `supabase-phieu-can-dinh-ki.sql` |

## API (`server.ts`)

| Path | Dòng |
|------|------|
| `/api/phieu-can-dinh-ki/*` | 5268–5274 (`registerWeighingSlipRoutes`) |

## Frontend

| File | Nội dung |
|------|----------|
| `src/components/WeighingShiftSummary.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Rule Cursor

`.cursor/rules/weighing-image-preview.mdc` — ảnh phải mở modal, không tab mới.
