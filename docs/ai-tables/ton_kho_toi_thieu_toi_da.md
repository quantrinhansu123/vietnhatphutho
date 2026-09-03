# ton_kho_toi_thieu_toi_da

| | |
|---|---|
| **Bảng** | `ton_kho_toi_thieu_toi_da` |
| **Tab** | `inventory-limits` → `/ton-kho-toi-thieu-toi-da`; `canh-bao-ton-kho` → `/canh-bao-ton-kho` |
| **SQL** | `supabase-ton-kho-toi-thieu-toi-da.sql` |

## API

| Method | Path |
|--------|------|
| GET/POST | `/api/ton-kho-toi-thieu-toi-da` |
| PATCH/DELETE | `/api/ton-kho-toi-thieu-toi-da/:id` |
| GET | `/api/canh-bao-ton-kho` |

## Frontend

`src/features/ton-kho-toi-thieu-toi-da/index.tsx`
`src/features/canh-bao-ton-kho/index.tsx`

Danh mục Mã AMIS và Tên sản xuất lấy từ `/api/san-pham` theo `san_pham_id`; mỗi sản phẩm không được trùng trong cùng tháng/năm. Bảng tồn kho chỉ lưu `san_pham_id`, không lưu lặp mã AMIS hoặc tên sản xuất.
