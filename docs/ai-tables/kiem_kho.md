# kiem_kho

| | |
|---|---|
| **Bảng** | `kiem_kho` |
| **Tab** | `kiem-kho` → `/kiem-kho` |
| **DB** | Riêng — label `phieu-can` (project `njdlkyxdieefeebcyaov`) |
| **SQL** | `supabase-kiem-kho.sql` |

## Cột

| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `bigint` identity PK | |
| `ten_kho` | `text` | |
| `dot_kiem_kho` | `text` | Đợt kiểm kho — phân biệt các lần kiểm |
| `ma_nvl` | `text` | Auto = tiền tố trước `_` của mã quét |
| `ma_sp` | `text` | Nguyên mã vừa quét (tiền tố + hậu tố) |
| `ten_sp` | `text` | autofill từ `san_pham` theo `ma_nvl` |
| `loai_sp` | `text` | autofill `nhom_vthh` |
| `ngay_gio_kiem_kho` | `timestamptz` | |
| `nguoi_kiem_kho` | `text` | |
| `da_dong_bo` | `boolean` | Chống cộng trùng vào `san_pham.ton_dau_ky` |
| `dong_bo_luc` | `timestamptz` | Thời điểm đồng bộ |
| `created_at` | `timestamptz` | |

## API (`server.ts`)

| Path | Ghi chú |
|------|---------|
| `GET /api/kiem-kho` | Query: `tenKho`, `dotKiemKho`, `maSp`, `from`, `to` |
| `POST /api/kiem-kho` | Body: `ten_kho`, `dot_kiem_kho`, `nguoi_kiem_kho`, `ngay_gio_kiem_kho`, `lines[]` |
| `DELETE /api/kiem-kho/:id` | Xóa một dòng |
| `POST /api/kiem-kho/dong-bo-ton-dau` | Cộng mỗi dòng chưa đồng bộ +1 vào tồn đầu sản phẩm theo `ma_nvl` |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kiem-kho/index.tsx` | Form thông tin phiếu (kho / đợt / người / giờ) + quét máy; `ma_nvl` auto từ tiền tố |
| `src/components/ProductQrScanner.tsx` | INPUT_CONNECTION + KEY_EVENT |

## Thêm cột trên DB đã có

Chạy lại `supabase-kiem-kho.sql` (có `add column if not exists dot_kiem_kho`) trên:
https://supabase.com/dashboard/project/njdlkyxdieefeebcyaov/sql/new
