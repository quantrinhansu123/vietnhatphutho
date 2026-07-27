# chi_phi_xe

| | |
|---|---|
| **Bảng** | `chi_phi_xe` |
| **Tab** | `vehicles` → `/danh-sach-xe` → Chi phí xe |
| **SQL** | `supabase-danh-sach-xe.sql` |

## API

`server.ts` — CRUD `/api/chi-phi-xe`; proxy giá xăng theo ngày `/api/chi-phi-xe/gia-xang?ngay=YYYY-MM-DD`

## Frontend

`src/features/danh-sach-xe/VehicleOperations.tsx` — danh sách, form, upload hóa đơn.
`src/features/_shared/recordHelpers.ts` — nén ảnh và Cloudinary thumbnail.

Chi tiết chi phí gồm số lượng, đơn giá (`so_tien`) và thành tiền được tính bằng số lượng × đơn giá.

## Liên kết

`danh_sach_xe`, `nhan_su`
