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

### Nhân sự theo vai trò

Phân công nhân sự được lưu trong **cột `phan_cong_nhan_su` (JSON, nguồn dữ liệu duy nhất)** dưới dạng mảng `AssignedPersonnel[]`.
Mỗi entry: `{ id, role, personnelId, date, time, removable }` — `personnelId` có thể là staff ID thật hoặc tên (nếu migrate từ dữ liệu cũ).

Các cột cũ `truong_ca`, `nhan_su_chinh`, `tho_phu`, `hoc_viec` vẫn tồn tại vật lý ở DB nhưng **không còn được dùng** ở tầng ứng dụng (giữ làm đường lui).
Cột `nhan_su` vẫn được tổng hợp từ toàn bộ mảng `personnel` để tương thích báo cáo, control-board, snapshot kế hoạch SX.

Form **Thêm / Sửa lệnh SX**: Phân công nhân sự dùng giao diện động (2 người/dòng, thêm/xóa được), mỗi entry có Ngày + Giờ riêng.
Dữ liệu cũ (trước khi cấu trúc này được áp dụng): lần đầu load qua `GET /api/lenh-sx`, server tự dựng lại mảng từ 4 cột cũ (lazy migration),
ghi ngược vào DB bất đồng bộ, client luôn nhận dữ liệu chuẩn hóa trong response.

### Lọc theo đăng nhập

- Nếu `cong_viec` / chức vụ đăng nhập đúng **Nhân Viên** (không phân biệt hoa thường, bỏ dấu khi so):
  chỉ hiện lệnh SX nếu `currentUser.id` khớp với **bất kỳ entry nào** trong mảng `phan_cong_nhan_su` (so theo ID trước).
  Nếu không khớp ID, fallback so tên: resolve mỗi entry (ID → tên qua danh sách nhân sự) rồi so với `currentUser.name` (tokenize, chuẩn hóa dấu như cũ).
  Cách này hỗ trợ dữ liệu cũ mà `personnelId` có thể là tên chứ không phải ID thật.
- Admin / fullAccess vẫn xem tất cả.

### Danh sách lệnh SX

Mỗi dòng lệnh: cột **Mã hàng / Tên hàng / Số lượng** trình bày bảng con (mỗi SP một dòng), không ghép bằng `|`.
