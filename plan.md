# Plan tổng hợp: Kế hoạch sản xuất

## 1. Mục tiêu

Hoàn thiện luồng thêm mới/cập nhật kế hoạch sản xuất để người dùng có thể chọn chính xác các lệnh SX cần lưu, khôi phục form Update về trạng thái ban đầu và chỉ thực hiện in từ kế hoạch đã lưu.

## 2. Phạm vi

- FE chính: `src/features/ke-hoach-san-xuat/index.tsx`.
- API hiện tại: `GET/PUT/DELETE /api/ke-hoach-sx` trong `server.ts`.
- Database: `ke_hoach_san_xuat` và `ke_hoach_san_xuat_dong`.
- Manifest: `docs/ai-tables/ke_hoach_san_xuat.md`.
- Không thêm dependency, endpoint hoặc migration mới.

## 3. Chọn lệnh sản xuất

### Giao diện checkbox

- Thêm checkbox trước cột `STT` cho từng dòng.
- Checkbox bo góc nhẹ, màu xanh khi được chọn và có focus state rõ ràng.
- Checkbox header đóng vai trò check-all:
  - Checked khi chọn toàn bộ.
  - Unchecked khi không chọn dòng nào.
  - Indeterminate khi chỉ chọn một phần.
- Hiển thị `Đã chọn X/Y lệnh SX` tại footer.
- Thao tác checkbox không xung đột với kéo/thả dòng.

### Flow Create

- Chỉ hiển thị các lệnh SX hợp lệ theo logic hiện tại.
- Mặc định chọn toàn bộ các dòng hiển thị.

### Flow Update

- Hiển thị toàn bộ lệnh SX tải từ `/api/lenh-sx`.
- Hợp nhất danh sách này với snapshot kế hoạch đã lưu.
- Giữ nguyên thứ tự ổn định của danh sách `/api/lenh-sx`; không gom các dòng được chọn lên trên hoặc đẩy dòng chưa chọn xuống dưới.
- Chỉ những lệnh đã thuộc kế hoạch được checked ban đầu.
- Các lệnh chưa thuộc kế hoạch vẫn hiển thị nhưng unchecked.
- Check-all áp dụng trên toàn bộ danh sách đang hiển thị.

## 4. Lưu kế hoạch

- FE chỉ gửi các dòng đang được chọn trong `items`.
- Không cho lưu khi chưa chọn dòng nào.
- Đánh lại `thu_tu_uu_tien` liên tục từ `1..N` cho các dòng được chọn.
- Backend giữ nguyên API hiện tại và chỉ cập nhật/lưu các dòng nhận được.
- `ke_hoach_san_xuat.so_lenh` bằng số dòng được chọn.
- Khi Update, detail cũ được thay bằng tập dòng mới nên dòng bị bỏ chọn không còn thuộc kế hoạch.
- Không cần cột boolean lựa chọn: có bản ghi trong `ke_hoach_san_xuat_dong` đồng nghĩa với đã chọn.

## 5. Khôi phục form Update

- Thêm button `id="btn-reset"`, label `Khôi phục`.
- Chỉ hiển thị trong flow Update.
- Khi màn hình load, lưu snapshot frontend gồm:
  - Toàn bộ dòng hiển thị, thứ tự và ghi chú từng dòng.
  - Danh sách ID đang checked.
  - Ngày kế hoạch.
  - Ghi chú chung.
  - Các ca được chọn trong bộ lọc.
- Dirty state được tính bằng cách so sánh state hiện tại với snapshot.
- Chỉ enable `btn-reset` khi form khác snapshot.
- Khi khôi phục:
  - Không gọi API.
  - Trả toàn bộ dữ liệu và checkbox về snapshot.
  - Xóa lỗi form và drag state tạm thời.
  - Dirty state trở về false.

## 6. Popup thêm mới/cập nhật

- Popup chỉ phục vụ nhập dữ liệu, chọn lệnh, sắp xếp và lưu.
- Không hiển thị các nút chức năng in.
- Phần `Lọc phiếu theo ca (khi in phiếu liên quan)` vẫn giữ trong popup.
- Lưu thành công đóng popup và tải lại Danh sách kế hoạch.

## 7. Chức năng In trong Danh sách kế hoạch

- Thêm nút `In` cạnh `Sửa` trên từng kế hoạch đã lưu:

```text
Xem | Sửa | In | Xóa
```

- Bấm `In` tải snapshot bằng `GET /api/ke-hoach-sx?id=<planId>`.
- Mọi bản in sử dụng các dòng snapshot đã lưu, không dùng toàn bộ lệnh SX đang hoạt động.
- Floating popup hiển thị sáu chức năng:
  1. Phân công nhân sự.
  2. Định mức NVL.
  3. In QR.
  4. In phiếu NVL.
  5. In kế hoạch.
  6. In tất cả phiếu liên quan.

## 8. Floating popup In

- Không backdrop và không thay đổi layout.
- Neo bên phải button vừa kích hoạt, cách `8px`.
- Tính vị trí bằng `getBoundingClientRect()`.
- Fallback sang bên trái khi không đủ chỗ bên phải.
- Dùng `position: fixed` và z-index cao.
- Cập nhật vị trí khi scroll, resize hoặc kích thước popup thay đổi.
- Có mã kế hoạch, ngày, số lệnh và nút `Đóng` rõ ràng.
- Khi mở modal con QR/Định mức, floating popup tạm ẩn để không che modal con.
- Trong thời gian floating popup mở, vùng Danh sách/Chi tiết phía sau ở trạng thái `inert`; người dùng phải đóng popup mới thao tác chức năng khác bằng chuột hoặc bàn phím.

## 9. Backend và database

- Không thay đổi API/business logic ngoài việc FE chỉ gửi các dòng được chọn.
- Tái sử dụng `PUT /api/ke-hoach-sx` để lưu.
- Tái sử dụng `GET /api/ke-hoach-sx?id=...` để in.
- Không thay đổi schema hoặc RLS.
- Không tạo migration mới.

## 10. Kiểm thử chấp nhận

### Checkbox và lưu

1. Create hiển thị danh sách hợp lệ và mặc định chọn toàn bộ.
2. Update hiển thị toàn bộ lệnh SX nhưng chỉ checked các dòng đã lưu.
3. Chọn/bỏ từng dòng hoạt động đúng.
4. Check-all chọn hoặc bỏ toàn bộ.
5. Indeterminate đúng khi chọn một phần.
6. Không thể lưu khi chọn `0` dòng.
7. Payload, `so_lenh` và detail chỉ chứa dòng được chọn.
8. Thứ tự lưu liên tục, không bị hổng.

### Khôi phục

1. Chưa thay đổi: `btn-reset` disabled.
2. Thay đổi một checkbox: button enabled.
3. Dùng check-all: button enabled.
4. Thay đổi ghi chú, ngày, thứ tự hoặc ca: button enabled.
5. Thay đổi nhiều lần rồi khôi phục: toàn bộ state đúng snapshot.
6. Tự hoàn tác về đúng snapshot: dirty tự trở về false.
7. Reset không phát sinh request API.

### In

1. Popup thêm/sửa không còn nút in nhưng vẫn có bộ lọc ca.
2. Nút `In` nằm cạnh `Sửa` và tải đúng kế hoạch.
3. Floating popup nằm bên phải cách `8px`; thiếu chỗ thì chuyển trái.
4. Popup giữ vị trí đúng khi scroll/resize.
5. Hiển thị đủ sáu chức năng và giữ nguyên kết quả in hiện tại.
6. Không thao tác được vùng nền cho tới khi đóng popup.
7. Chuyển kế hoạch không dùng nhầm cache hoặc state cũ.
8. Loading, lỗi API và click lặp được xử lý đúng.

## 11. Xác minh kỹ thuật

- Chạy parser/build cho TSX.
- Chạy `git diff --check`.
- Chạy TypeScript check và phân biệt lỗi mới với lỗi tồn tại sẵn ngoài feature.
- Không sửa file hoặc refactor phần không liên quan.
