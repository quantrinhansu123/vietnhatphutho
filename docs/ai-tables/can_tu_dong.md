# can_tu_dong

| | |
|---|---|
| **Bảng** | `can_tu_dong` |
| **Tab** | `can-tu-dong` → `/can-tu-dong` |
| **DB** | Riêng — label `phieu-can` (`SUPABASE_WEIGHING_*`) |
| **SQL** | (bảng đã có trên project cân; không migration local) |

## Env

| Biến | Mặc định |
|------|----------|
| `SUPABASE_CAN_TU_DONG_TABLE` | `can_tu_dong` |
| `SUPABASE_CAN_TU_DONG_STORAGE_BUCKET` | `roll-captures` |

## API (`server.ts`)

| Path | Ghi chú |
|------|---------|
| `GET /api/can-tu-dong` | Client `supabaseWeighing`; thêm `preview_url` (Cloudinary hoặc signed storage) |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/can-tu-dong/index.tsx` | Bảng danh sách + modal ảnh |
| `src/components/WeighingImagePreviewModal.tsx` | Thumbnail + modal (không `target="_blank"`) |
| `src/App.tsx` | Import + route tab |

## Rule Cursor

`.cursor/rules/weighing-image-preview.mdc` — ảnh mở modal trong app.
