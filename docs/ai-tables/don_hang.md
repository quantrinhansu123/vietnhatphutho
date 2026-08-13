# don_hang

| | |
|---|---|
| **Bảng** | `don_hang` |
| **Tab** | `orders` → `/don-hang` |
| **SQL** | `supabase-don-hang-*.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/don-hang` | 3872–3999 |

Helper tự sinh mã: `generateNextOrderCodeFromDb()` ~2924.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/don-hang/index.tsx` | Panel / logic chính |
| `src/features/_shared/orderHelpers.ts` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Tạo lệnh SX: `POST /api/lenh-sx/from-don-hang/:id`

### Form đơn hàng

- **Khách hàng**: sổ xuống (`<select>`) lấy từ `/api/khach-hang` (bảng danh mục Khách hàng), bắt buộc chọn.
- **Quy đổi khi thêm mới**: tải `san_pham_quy_doi`, khớp mã SP + đơn vị và hiển thị mét dài, m², kg có thể tính. Kế hoạch/công thức: `tinh_toan_quy_doi.md`.
- Dòng JSON `san_pham` có `kq_quy_doi` khi tính được; thiếu cấu hình quy đổi vẫn cho phép thêm/cập nhật đơn hàng.
