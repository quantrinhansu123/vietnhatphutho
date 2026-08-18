# Kế hoạch hiển thị quy đổi kg tại `/san-pham`

## Mục tiêu

- Chỉ áp dụng cho sản phẩm có `tinh_chat = "Thành phẩm"` (so sánh không phân biệt hoa/thường và khoảng trắng).
- Ngay dưới dòng sản phẩm chính, hiển thị thêm một dòng quy đổi sang `kg`.
- Dòng phụ bắt đầu có nội dung từ cột **Đơn vị**; các cột định danh phía trước để trống.
- Đây là dữ liệu hiển thị được tính tức thời, không tạo thêm bản ghi trong `san_pham`.

## Bố cục dòng quy đổi

Theo bảng hiện tại, dòng phụ có 15 cột:

| Cột | Nội dung dòng phụ |
|---|---|
| Chọn | Trống |
| Mã SP | Trống |
| Mã QR | Trống |
| Tên sản phẩm | Trống |
| Tên sản xuất | Trống |
| Tính chất | Trống |
| Nhóm | Trống |
| Đơn vị | `kg` |
| Tổng TL | Giá trị kg nếu có cơ sở tính |
| Tồn đầu | Tồn đầu quy đổi kg |
| Nhập | Nhập trong kỳ quy đổi kg |
| Xuất | Xuất trong kỳ quy đổi kg |
| Tồn | Tồn kho quy đổi kg |
| Tồn tối thiểu | Tồn tối thiểu quy đổi kg |
| Thao tác | Trống |

Dòng phụ dùng nền xanh lá rất nhạt và nhãn nhỏ `Quy đổi` cạnh `kg` để người dùng phân biệt với dữ liệu gốc.

## Dữ liệu sử dụng

1. Tải danh sách `san_pham` như hiện tại.
2. Tải toàn bộ `san_pham_quy_doi` một lần khi mở màn hình, tự lấy tiếp các trang API nếu vượt 200 dòng.
3. Ghép bảng theo `san_pham.id`; không ghép bằng tên sản phẩm.
4. ĐVT nguồn lấy từ `san_pham.don_vi`, chỉ gồm `m`, `m2`, `Tấm`.
5. ĐVT đích cố định là `kg`.

## Hàm quy đổi chung

Tạo một hàm thuần dùng chung:

```ts
convertProductQuantityToKg(quantity, productUnit, conversion): number | null
```

Quy tắc:

- ĐVT `Tấm`:
  - Ưu tiên `kg = SL × trong_luong_kg_tam`.
  - Nếu thiếu `kg/tấm`: `kg = SL × kho_tam_dai_m × trong_luong_kg_m_dai`.
- ĐVT `m`:
  - Ưu tiên `kg = SL × trong_luong_kg_m_dai`.
  - Nếu thiếu `kg/m dài` và có `kg/m2`: `kg = SL × khổ rộng × trong_luong_kg_m2`.
  - Khổ rộng ưu tiên `kho_tam_rong_m`, sau đó `kho_cuon_rong_m`.
- ĐVT `m2`:
  - `kg = SL × trong_luong_kg_m2`.
- Giá trị rỗng, `-`, không phải số hoặc không đủ hệ số: trả về `null`.
- Không dùng `tong_trong_luong` làm hệ số thay thế cho bảng quy đổi.
- Kết quả làm tròn tối đa 3 chữ số thập phân khi hiển thị; dữ liệu gốc không bị thay đổi.

## Áp dụng theo từng cột

Gọi cùng một hàm cho:

- `ton_dau_ky`
- `nhap_trong_ky`
- `xuat_trong_ky`
- `sl_ton`
- `so_luong_ton_toi_thieu`

Riêng cột `Tổng TL (kg)`:

- Nếu `tong_trong_luong` đã là kg thì hiển thị trực tiếp.
- Không nhân `tong_trong_luong` thêm lần nữa.

## Trạng thái thiếu dữ liệu

- Thành phẩm chưa có dòng `san_pham_quy_doi`: vẫn hiện dòng phụ, cột Đơn vị là `kg`, các kết quả là `—`.
- Có bảng quy đổi nhưng thiếu hệ số cho ĐVT của `san_pham`: hiển thị `—` và tooltip `Chưa đủ hệ số quy đổi sang kg`.
- Không hiển thị lỗi kỹ thuật Supabase cho người dùng; dùng thông báo tiếng Việt và toast hiện có.
- Lỗi tải bảng quy đổi không làm mất danh sách sản phẩm gốc.

## Tối ưu UI và hiệu năng

- Lập `Map<san_pham_id, conversion>` bằng `useMemo` để tránh tìm tuyến tính ở từng ô.
- Tính một object kết quả kg cho mỗi sản phẩm bằng `useMemo`.
- Search/filter vẫn lọc theo dòng sản phẩm chính; dòng kg luôn đi cùng sản phẩm cha.
- Checkbox và thao tác chỉ xuất hiện trên dòng chính.
- Khi hover dòng chính hoặc dòng kg, tô cùng một nhóm màu để thể hiện quan hệ.

## Các bước coding

1. Tách hàm `convertProductQuantityToKg` sang utility dùng chung với `/don-hang` để hai màn hình dùng cùng công thức.
2. Bổ sung tải `san_pham_quy_doi` trong feature `/san-pham`.
3. Tạo map quy đổi theo `san_pham_id`.
4. Render `React.Fragment`: dòng sản phẩm chính và dòng kg có điều kiện.
5. Cập nhật `colSpan`, sticky column và giao diện mobile nếu có.
6. Dùng tooltip tiếng Việt cho giá trị không tính được.
7. Cập nhật manifest `docs/ai-tables/san_pham.md`.
8. Kiểm thử và build frontend/server/Vercel handler.

## Case kiểm thử bắt buộc

1. Thành phẩm ĐVT `Tấm`, có `kg/tấm`.
2. Thành phẩm ĐVT `Tấm`, chỉ có `m/tấm + kg/m dài`.
3. Thành phẩm ĐVT `m`, có `kg/m dài`.
4. Thành phẩm ĐVT `m`, chỉ có `khổ rộng + kg/m2`.
5. Thành phẩm ĐVT `m2`, có `kg/m2`.
6. Thành phẩm thiếu bảng quy đổi.
7. Sản phẩm không phải Thành phẩm: không xuất hiện dòng kg.
8. Các giá trị tồn bằng `0`, rỗng và số thập phân.
9. Search/filter không tách dòng kg khỏi dòng sản phẩm cha.

## Điều kiện hoàn thành

- Mỗi Thành phẩm có đúng một dòng kg ngay bên dưới.
- Tất cả cột số lượng dùng cùng công thức với `/don-hang`.
- Không ghi ngược kết quả kg vào `san_pham`.
- Không ảnh hưởng sửa, xóa, chọn dòng hoặc in QR.
