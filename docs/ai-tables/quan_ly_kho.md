# quan_ly_kho

| | |
|---|---|
| **Bảng** | `quan_ly_kho` |
| **Tab** | `quan-ly-kho` → `/quan-ly-kho` |
| **DB** | Chính — label `he-thong` (project `frgoljnscvpxbctplmiq`) |
| **SQL** | `supabase-quan-ly-kho.sql` + `supabase-quan-ly-kho-ma-kho.sql` (`ma_kho`) |

## Cột

| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `bigint` identity PK | |
| `ten_kho` | `text` | Tên kho |
| `ma_kho` | `text` unique, nullable | Mã ngầm tự sinh từ tên (không dấu, nối `_`): `Kho cắt lẻ` → `kho_cat_le`. Nguồn thật cho `nhap_kho.loai_kho` và `loai_kho` phiếu — ổn định khi đổi tên |
| `vi_tri` | `text` | Vị trí |
| `ten_vi_tri` | `text` | Tên vị trí |
| `nguoi_phu_trach` | `text` | Người phụ trách |
| `created_at` | `timestamptz` | |

## API

| Path | Method | Ghi chú |
|------|--------|---------|
| `/api/quan-ly-kho` | GET, POST | POST tự sinh `ma_kho` duy nhất (trùng thì `_2`...) |
| `/api/quan-ly-kho/:id` | PUT, DELETE | PUT giữ `ma_kho` khi đổi tên, tự lấp khi trống |

Kho cũ thiếu mã: `node scripts/backfill-ma-kho.mjs`.

## Frontend

`src/features/quan-ly-kho/index.tsx`

## Tạo bảng

Chạy `supabase-quan-ly-kho.sql` trên:
https://supabase.com/dashboard/project/njdlkyxdieefeebcyaov/sql/new
