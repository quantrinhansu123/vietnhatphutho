# Báo cáo phối trộn — quy tắc UI

Tài liệu mô tả hành vi giao diện cho module **Báo cáo phối trộn** (`/bao-cao-phoi-tron`, `/danh-sach-bao-cao-phoi-tron`).

## Modal chi tiết danh sách (`/danh-sach-bao-cao-phoi-tron`)

### Ảnh xác nhận theo Lần

- Ảnh hiển thị ở **cột trái** modal, xếp **theo chiều dọc** (thumbnail rộng full cột, cao ~144px).
- Nếu nhiều ảnh vượt chiều cao modal: cột trái có **thanh cuộn dọc**.
- Mỗi nhóm ảnh gắn nhãn theo Lần phối trộn (ví dụ: `Ảnh · Lần 2`).
- Nếu chưa có ảnh: hiện placeholder “Chưa có ảnh xác nhận”.

### Xem ảnh — không mở tab mới

- **Click thumbnail** → phóng to ảnh **ngay trên modal chi tiết** (lớp overlay trong cùng modal).
- **Không** dùng `target="_blank"` hay chuyển sang URL ảnh ở tab/cửa sổ mới.
- Nút **Đóng ảnh** (hoặc đóng modal chi tiết) để quay lại danh sách thumbnail + bảng NVL.

### Bảng NVL

- Bảng nằm **bên phải** (desktop), gồm KL định mức và KL thực tế.
- Modal rộng tối đa ~1280px, chiều cao tối đa ~96vh.

## Danh sách (`/danh-sach-bao-cao-phoi-tron`)

- Mỗi phiếu có nút **Xem**, **Sửa**, **Xóa**.
- **Sửa** mở modal form với dữ liệu phiếu đã lưu; lưu bằng `PATCH /api/bao-cao-phoi-tron/:id`.
- **Thêm mới** mở cùng modal form trống; lưu bằng `POST`.

## Form nhập (`/bao-cao-phoi-tron`)

- Ảnh upload theo từng Lần; Lần tự tăng theo ca + ngày + máy.
- NVL gợi ý theo Lệnh sản xuất đã chọn trong Lần (lọc theo ca và máy).
- Không có bảng tổng bên phải; footer có Thực tế sử dụng + Lưu báo cáo.
