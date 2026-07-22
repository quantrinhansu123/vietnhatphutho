# nhat_ky_xe

| | |
|---|---|
| **Bảng** | `nhat_ky_xe` |
| **Tab** | `vehicles` → `/danh-sach-xe` → Nhật ký xe |
| **SQL** | `supabase-danh-sach-xe.sql` |

## API

`server.ts` — CRUD `/api/nhat-ky-xe`

## Frontend

`src/features/danh-sach-xe/VehicleOperations.tsx` — danh sách, tổng hợp và form (3 tab).

### Form tabs

1. **Doanh thu mặt hàng** — `tong_mat_hang`, `tong_doanh_thu`, `tong_chi_phi`, `ghi_chu`
2. **Số KM thực đi** — thưởng chuyến, công/thưởng KM, chỉ số KM trước/về, KM thực tế, số lệnh, số chuyến
3. **Lương lái xe** — `ten_lx1`, `cong_lx1`, `luong_lx1`, `tien_an_lx1`, `tien_ds_lx1`, `tien_thuong_chuyen_lx1`, `tien_luat_lx1`

## Liên kết

`danh_sach_xe`, `nhan_su`, `chi_phi_xe`
