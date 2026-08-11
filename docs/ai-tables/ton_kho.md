# ton_kho

| | |
|---|---|
| **Chức năng** | Tổng hợp tồn NVL và thành phẩm (chỉ đọc) |
| **Tab** | `ton-kho` → `/ton-kho` |
| **Bảng nguồn** | `kho_nvl`, `san_pham`, `phieu_xuat_nhap_kho`, `quan_ly_kho` |
| **SQL** | `supabase-ton-kho.sql` |

## API (`server.ts`)

| Method | Path |
|--------|------|
| GET | `/api/ton-kho/chi-tiet` |
| GET | `/api/ton-kho/tong-hop` |
| GET | `/api/quan-ly-kho` (danh mục lọc) |

Backend ưu tiên RPC `ton_kho_nvl_gop` / `ton_kho_san_pham_gop`; thiếu RPC (`PGRST202`) thì tính dự phòng từ bảng nguồn.

## Frontend

`src/features/ton-kho/index.tsx`
