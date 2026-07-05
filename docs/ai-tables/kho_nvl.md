# kho_nvl

| | |
|---|---|
| **Bảng** | `kho_nvl` |
| **Tab** | `materials` → `/kho-nvl` |
| **SQL** | `supabase-kho-nvl.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/kho-nvl` | 4605 |
| POST | `/api/kho-nvl` | 4633 |
| POST | `/api/kho-nvl/fill-total-kg` | 4661 |
| PATCH | `/api/kho-nvl/:id` | 4713 |
| DELETE | `/api/kho-nvl/:id` | 4752 |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-nvl/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Phiếu xuất nhập (`phieu_xuat_nhap_kho`) cập nhật tồn kho NVL.
