# quan_ly_kho

| | |
|---|---|
| **Bảng** | `quan_ly_kho` |
| **Tab** | `quan-ly-kho` → `/quan-ly-kho` |
| **DB** | Chính — label `he-thong` (project `frgoljnscvpxbctplmiq`) |
| **SQL** | `supabase-quan-ly-kho.sql` |

## Cột

| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `bigint` identity PK | |
| `ten_kho` | `text` | Tên kho |
| `vi_tri` | `text` | Vị trí |
| `ten_vi_tri` | `text` | Tên vị trí |
| `nguoi_phu_trach` | `text` | Người phụ trách |
| `created_at` | `timestamptz` | |

## API

| Path | Method |
|------|--------|
| `/api/quan-ly-kho` | GET, POST |
| `/api/quan-ly-kho/:id` | PUT, DELETE |

## Frontend

`src/features/quan-ly-kho/index.tsx`

## Tạo bảng

Chạy `supabase-quan-ly-kho.sql` trên:
https://supabase.com/dashboard/project/njdlkyxdieefeebcyaov/sql/new
