# lenh_sx

| | |
|---|---|
| **Bảng** | `lenh_sx` |
| **Tab** | `production-orders` → `/lenh-san-xuat` |
| **SQL** | `supabase-lenh-sx.sql`, `supabase-lenh-sx-drop-personnel-columns.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/lenh-sx` | ~7461 |
| POST | `/api/lenh-sx` | ~7599 |
| POST | `/api/lenh-sx/from-don-hang/:id` | ~7505 |
| PATCH/DELETE | `/api/lenh-sx/:id` | ~7961 |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/lenh-sx/index.tsx` | Panel / logic chính |
| `src/features/ke-hoach-san-xuat/index.tsx` | Form thêm / sửa lệnh SX |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |

## Liên kết

`ke_hoach_san_xuat`, `don_hang`, `san_pham`

### Phân công nhân sự

Form **Thêm / Sửa lệnh SX** không ghi `phan_cong_nhan_su` (JSON trên `lenh_sx`) và không ghi bảng `phan_cong_nhan_su_chi_tiet`.

Lịch làm việc theo ngày / ca / máy do tab **Sắp xếp lịch làm việc** ghi thẳng vào `phan_cong_nhan_su_chi_tiet`. Chi tiết lệnh SX đọc lịch từ `GET /api/phan-cong-nhan-su?ma_lenh_sx=...`.

Chạy `supabase-lenh-sx-drop-personnel-columns.sql` để xóa các cột cũ trên `lenh_sx`: `truong_ca`, `nhan_su_chinh`, `tho_phu`, `hoc_viec`, `phan_cong_nhan_su`.

Cột `nhan_su` vẫn giữ trên lệnh SX (mặc định “Chưa phân công”) cho báo cáo / snapshot kế hoạch.

### Lọc theo đăng nhập

- Nếu `cong_viec` / chức vụ đăng nhập đúng **Nhân Viên** (không phân biệt hoa thường, bỏ dấu khi so):
  chỉ hiện lệnh SX nếu `currentUser.id` khớp với **bất kỳ entry nào** còn lại trong dữ liệu nhân sự của lệnh (so theo ID trước, fallback theo tên).
- Admin / fullAccess vẫn xem tất cả.

### Danh sách lệnh SX

Mỗi dòng lệnh: cột **Mã hàng / Tên hàng / Số lượng** trình bày bảng con (mỗi SP một dòng), không ghép bằng `|`.
