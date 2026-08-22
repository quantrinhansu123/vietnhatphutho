# Triển khai chọn Ca làm việc trong Lệnh Sản xuất

## Thay đổi được thực hiện

### 1. Frontend - EditProductionOrderModal (src/features/ke-hoach-san-xuat/index.tsx)

**Cái được cập nhật:**
- Thêm state `selectedShift` để quản lý lựa chọn ca
- Thêm state `settings` để lưu cài đặt ca từ API
- Thêm state `isLoadingSettings` cho trạng thái tải cài đặt
- Tải dữ liệu từ `/api/cai-dat` để lấy danh sách ca

**Tính năng mới:**
- Replace text input cho ca với radio button selection (giống AddProductionOrderModal)
- Hiển thị tất cả các ca có sẵn dưới dạng button có thể click
- Định dạng hiển thị ca với giờ (ví dụ: "Ca 1 (06:00 - 14:00)")
- Validation để đảm bảo người dùng phải chọn ca trước khi lưu

### 2. Backend - server.ts

**Cập nhật `savePhanCongNhanSuDetails` function:**
- Thêm parameter `ca` (ca làm việc)
- Thêm parameter `may` (tên máy)
- Lưu `ca_lam_viec` và `may` vào bảng `phan_cong_nhan_su_chi_tiet`

**Cập nhật POST endpoint (`/api/lenh-sx`):**
- Truyền `ca` và `may` từ record sang `savePhanCongNhanSuDetails`

**Cập nhật PATCH endpoint (`/api/lenh-sx/:id`):**
- Truyền `ca` và `may` từ record sang `savePhanCongNhanSuDetails`

### 3. Database - SQL Migration

**Tạo file:** `supabase-phan-cong-nhan-su-them-ca-may.sql`
- Thêm cột `ca_lam_viec` (text) - lưu ca làm việc
- Thêm cột `may` (text) - lưu tên máy

## Dòng dữ liệu

1. Khi thêm/sửa lệnh SX:
   - Người dùng chọn ca từ dropdown radio button
   - Frontend gửi `ca` trong payload

2. Backend xử lý:
   - `parseProductionOrderBody` trích xuất `ca` từ request body
   - Lưu `ca` vào bảng `lenh_sx` (cột `ca`)
   - Lưu `phan_cong_nhan_su` (JSON array) vào bảng `lenh_sx`

3. Lưu chi tiết phân công:
   - `savePhanCongNhanSuDetails` được gọi với `ca` và `may`
   - Mỗi bản ghi nhân sự được lưu vào `phan_cong_nhan_su_chi_tiet`
   - Các cột được lưu:
     - `id_lenh_sx` - ID lệnh SX
     - `ma_lenh_sx` - Mã lệnh SX
     - `vai_tro` - Vai trò (Trưởng ca, NS chính, Thợ phụ, Học việc)
     - `ma_nhan_su` - ID nhân sự
     - `ca_lam_viec` - Ca làm việc (NEW)
     - `may` - Tên máy (NEW)
     - `ngay_lam_viec` - Ngày làm việc
     - `thoi_gian_bat_dau` - Giờ bắt đầu
     - `thoi_gian_ket_thuc` - Giờ kết thúc

## Hướng dẫn triển khai

1. **Chạy SQL migration** trong Supabase SQL Editor:
   - Mở file `supabase-phan-cong-nhan-su-them-ca-may.sql`
   - Copy toàn bộ nội dung
   - Paste vào Supabase SQL Editor
   - Chạy để thêm các cột mới

2. **Deploy code** (frontend + backend):
   - Frontend sẽ hiển thị UI chọn ca mới
   - Backend sẽ lưu ca và may vào chi tiết phân công

3. **Kiểm tra**:
   - Tạo/sửa lệnh SX
   - Chọn ca từ dropdown
   - Phân công nhân sự
   - Lưu và kiểm tra bảng `phan_cong_nhan_su_chi_tiet` để xác nhận ca và may được lưu

## Ghi chú

- EditProductionOrderModal sử dụng radio button (single select) khác với AddProductionOrderModal
  dùng checkbox (multiple select). Điều này phù hợp vì sửa 1 lệnh SX chỉ cần 1 ca.
- Dữ liệu `phan_cong_nhan_su` được lưu dưới dạng JSON string trong cả 2 bảng:
  - `lenh_sx.phan_cong_nhan_su` - JSON string gốc
  - `phan_cong_nhan_su_chi_tiet` - Normalized rows (denormalized cho query dễ)
- Ca và máy được lưu vào `phan_cong_nhan_su_chi_tiet` để dễ query và thống kê theo ca/máy
