# thu_tien_khach_hang

| | |
|---|---|
| **Bảng** | `thu_tien_khach_hang` |
| **Tab** | `vehicles` → `/danh-sach-xe` → Thu tiền khách hàng |
| **SQL** | `supabase-thu-tien-khach-hang.sql` |

## API

`server.ts` — CRUD `/api/thu-tien-khach-hang`. Insert/update/delete đồng bộ giảm/khôi phục `khach_hang.cong_no` qua `adjustCustomerDebt()` (khớp `ma_khach_hang`).

`PATCH /api/thu-tien-khach-hang/:id/anh` — chỉ cập nhật `anh_url` / `anh_public_id` sau khi upload Cloudinary bất đồng bộ (không đụng công nợ).

## Frontend

`src/features/danh-sach-xe/VehicleOperations.tsx` — `CustomerPaymentsView` + `CustomerPaymentModal`: chọn khách hàng (`SearchableSelect`, hiển thị công nợ hiện tại), số tiền, hình thức (Tiền mặt/Chuyển khoản), biển số xe tùy chọn, người thu, **chụp ảnh**.

Ảnh: nén local → preview ngay → `uploadImage(..., 'xe/thu_tien_khach_hang')` chạy nền; lưu phiếu không chờ Cloudinary; khi upload xong PATCH ảnh vào phiếu.

Chọn **Chuyển khoản** → hiện VietQR (VietinBank `970415`, STK `100001692967`) qua `img.vietqr.io`, gắn `amount` + nội dung thu theo khách hàng.

## Liên kết

`khach_hang` (cập nhật `cong_no`), `danh_sach_xe`, Cloudinary, VietQR
