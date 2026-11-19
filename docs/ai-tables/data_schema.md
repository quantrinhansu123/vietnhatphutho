# data_schema (menu Data)

| | |
|---|---|
| **Phạm vi** | Schema `public` trên Supabase (mọi bảng user) |
| **Tab** | `data` → `/data` (menu Quản trị → **Data**) |
| **SQL** | Không — đọc/ghi live DB |
| **API** | `/api/data/*` trong `serverDataAdmin.ts` (đăng ký từ `server.ts`) |
| **UI** | `src/features/data/index.tsx` |

## Nghiệp vụ

- List bảng + cột (`information_schema` / `pg_catalog` qua Postgres).
- CRUD dòng qua Supabase client (service key).
- DDL có kiểm soát: tạo/xóa bảng, thêm/đổi tên/xóa cột — identifier whitelist, kiểu cột whitelist, xóa cần `confirmName`.
- Không có ô SQL tự do; không đụng `auth` / `storage`.

## Cấu hình

- **Catalog + CRUD dòng:** luôn dùng được với `SUPABASE_URL` + service key (fallback PostgREST OpenAPI khi chưa có Postgres).
- **DDL đầy đủ:** cần `SUPABASE_DB_URL` hoặc `SUPABASE_DB_PASSWORD` (+ `SUPABASE_URL`).
