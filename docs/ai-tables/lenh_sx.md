# lenh_sx

| | |
|---|---|
| **Bảng** | `lenh_sx` |
| **Tab** | `production-orders` → `/lenh-san-xuat` |
| **SQL** | `supabase-lenh-sx.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/lenh-sx` | 4001 |
| POST | `/api/lenh-sx` | 4138 |
| POST | `/api/lenh-sx/from-don-hang/:id` | 4044 |
| PATCH/DELETE | `/api/lenh-sx/:id` | 4362–4434 |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/lenh-sx/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

`ke_hoach_san_xuat`, `don_hang`, `san_pham`

## Nhân sự theo vai trò

Các cột `truong_ca`, `nhan_su_chinh`, `tho_phu`, `hoc_viec` được nhập trong form thêm/sửa lệnh.
Cột `nhan_su` vẫn giữ chuỗi tổng hợp để tương thích báo cáo và dữ liệu cũ.
