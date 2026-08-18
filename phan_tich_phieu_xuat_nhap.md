# Phân tích tự động lấy NVL theo Lệnh sản xuất tại `/phieu-xuat-nhap-kho`

## 1. Mục tiêu

Khi lập **phiếu xuất kho NVL**, người dùng chọn một **Mã lệnh sản xuất**. Hệ thống tìm Phiếu trộn định mức gắn với mã lệnh đó, lấy danh sách NVL và tự điền vào chi tiết phiếu.

Mỗi dòng cần hiển thị:

| Trường | Nguồn / cách xử lý |
|---|---|
| Mã NPL | `chi_tiet[].nvl[].ma_nvl` của `bang_tron_vat_tu_dinh_muc` |
| Tên NVL | Ưu tiên tên mới nhất trong `kho_nvl`, fallback `chi_tiet[].nvl[].ten_nvl` |
| Đơn vị tính | Lấy từ danh mục `kho_nvl`, không dùng `don_vi` của công thức định mức |
| Số lượng | Người dùng nhập; có thể gợi ý từ khối lượng định mức nhưng không khóa |
| Quy đổi (kg) | Tự tính theo ĐVT và hệ số trong `kho_nvl` |
| Giá | Người dùng nhập; có thể giữ cơ chế gợi ý giá bình quân nhập hiện tại |
| Thành tiền | `Số lượng × Giá` |

Chỉ tự động lấy NVL khi thỏa cả hai điều kiện:

- Loại kho là **Kho NVL**.
- Loại phiếu là **Xuất kho**.

## 2. Các bảng liên quan

### Bảng chính

| Bảng | Vai trò | Trường liên quan |
|---|---|---|
| `lenh_sx` | Danh sách lệnh để người dùng tìm/chọn | `id`, `ma_lenh_sx`, `ca`, `may`, `san_pham` |
| `bang_tron_vat_tu_dinh_muc` | Nguồn NVL theo lệnh SX | `id`, `ma_lenh_sx`, `ngay`, `ca`, `chi_tiet`, `tong_trong_luong` |
| `kho_nvl` | Danh mục chuẩn của NVL và hệ số kg/đơn vị | mã NPL, tên NPL, ĐVT, cột **Tổng kg** |
| `phieu_xuat_nhap_kho` | Lưu từng dòng xuất kho | `ma_phieu`, `ma_npl`, `ten_npl`, `don_vi`, `so_luong`, `don_gia`, `thanh_tien` |

### Bảng tham khảo, không phải nguồn chính

| Bảng | Kết luận |
|---|---|
| `phieu_tron_thuc_te` | Là số liệu trộn thực tế, không dùng để lập nhu cầu xuất theo định mức |
| `bao_cao_phoi_tron` | Là báo cáo phối trộn, không phải danh mục hệ số quy đổi NVL |
| `san_pham_quy_doi` | Dùng quy đổi đơn vị của **sản phẩm/thành phẩm**, không dùng cho NVL |

Route `/danh-sach-bao-cao-phoi-tron` chỉ là giao diện tổng hợp. Tab **Phiếu trộn định mức** đọc `bang_tron_vat_tu_dinh_muc`; vì vậy phải lấy dữ liệu từ bảng/API này, không phụ thuộc vào route giao diện.

## 3. Dữ liệu định mức hiện có

`bang_tron_vat_tu_dinh_muc.chi_tiet` đang có cấu trúc:

```json
[
  {
    "ma_sp": "...",
    "ten_sp": "...",
    "tong_trong_luong": 1000,
    "nvl": [
      {
        "ma_nvl": "...",
        "ten_nvl": "...",
        "gia_tri": 10,
        "don_vi": "%",
        "khoi_luong": 100
      }
    ]
  }
]
```

Trong Phiếu trộn định mức:

- Nếu `don_vi = %`: `khoi_luong = tong_trong_luong × gia_tri / 100`.
- Nếu `don_vi = kg`: `khoi_luong = gia_tri`.
- `khoi_luong` luôn là kg định mức của NVL.
- `don_vi` trong JSON là đơn vị của **công thức định mức** (`%` hoặc `kg`), không nhất thiết là đơn vị xuất kho.

Khi một mã NVL xuất hiện ở nhiều sản phẩm trong cùng lệnh, cần gộp theo mã chuẩn hóa và cộng `khoi_luong`:

```text
khối lượng định mức NVL = tổng chi_tiet[].nvl[].khoi_luong cùng mã NVL
```

## 4. Quy đổi kg lấy từ đâu?

### Kết luận

Không lấy từ `san_pham_quy_doi` và không lấy từ `bao_cao_phoi_tron`.

Luồng quy đổi hiện có tại `/phieu-xuat-nhap-kho` dùng `src/utils/warehouseWeight.ts`:

```text
Nếu ĐVT là kg: quy đổi kg = số lượng
Nếu ĐVT là tấn: quy đổi kg = số lượng × 1.000
Nếu ĐVT là g: quy đổi kg = số lượng / 1.000
ĐVT NVL khác: quy đổi kg = số lượng × Tổng kg của mã NVL trong kho_nvl
```

Với NVL, hệ thống hiện chủ ý chỉ dùng cột **Tổng kg** của `kho_nvl`, không suy đoán từ tên NVL. Nếu thiếu hệ số thì hiển thị **Chưa có hệ số quy đổi**, không tự tính phỏng đoán.

`khoi_luong` trong Phiếu trộn định mức là **khối lượng nhu cầu định mức**, không phải hệ số kg/đơn vị. Có thể dùng nó để:

- Hiển thị “Định mức (kg)”.
- Nếu ĐVT xuất là kg, gợi ý số lượng bằng chính `khoi_luong`.
- Nếu ĐVT khác kg và có `Tổng kg > 0`, gợi ý `Số lượng = khoi_luong / Tổng kg`.

Người dùng vẫn được sửa Số lượng; sau khi sửa, “Quy đổi kg” phải tính lại theo công thức trên.

## 5. Khoảng trống hiện tại

1. Giao diện đã tải và cho chọn Lệnh SX nhưng hiện chỉ tự điền dòng khi chọn **Kho Sản phẩm**; chọn **Kho NVL** chưa tải Phiếu trộn định mức.
2. API `GET /api/bang-tron-vat-tu-dinh-muc` mới có `ngay`, `ca`, `q`; chưa có filter chính xác `ma_lenh_sx`.
3. `phieu_xuat_nhap_kho` chưa có cột `ma_lenh_sx`. `productionOrderRef` hiện chủ yếu nằm trong draft/in phiếu, chưa được lưu bền vững cùng chứng từ.
4. Chưa có quy tắc dữ liệu khi một Lệnh SX có nhiều Phiếu trộn định mức. Nếu cộng tất cả các phiếu có thể bị nhân đôi do có bản sửa/nhập lại.
5. Phiếu kho đang cho chọn nhiều mã Lệnh SX. Yêu cầu mới nói “nhập mã Lệnh sản xuất” ở số ít; cần thống nhất một lệnh/phiếu hoặc quy định rõ cách gộp nhiều lệnh.

## 6. Quy tắc nghiệp vụ đề xuất

1. Một phiếu xuất NVL gắn với **một** `ma_lenh_sx` để truy vết rõ ràng.
2. Chỉ cho áp dụng tự động khi có đúng một Phiếu trộn định mức hợp lệ.
3. Nếu không có phiếu định mức: thông báo “Lệnh sản xuất này chưa có Phiếu trộn định mức”, giữ form để người dùng nhập tay.
4. Nếu có nhiều phiếu định mức: không âm thầm cộng; yêu cầu chọn phiếu hoặc bổ sung trạng thái/phiên bản để xác định bản đang áp dụng.
5. Gộp NVL trùng mã trong `chi_tiet`, cộng `khoi_luong`; tên và ĐVT lấy từ `kho_nvl`.
6. Số lượng là ô được sửa. Quy đổi kg là kết quả chỉ đọc và tính lại ngay khi Số lượng/ĐVT thay đổi.
7. Giá là ô được sửa. Thành tiền tính theo số lượng giao dịch: `so_luong × don_gia`, không nhân thêm lần nữa với kg quy đổi.
8. Không có hệ số quy đổi vẫn cho lưu phiếu nếu nghiệp vụ cho phép, nhưng phải hiển thị rõ “Chưa có hệ số quy đổi”; không lưu kết quả kg sai.
9. Khi đổi hoặc bỏ chọn Lệnh SX mà người dùng đã sửa dòng, phải cảnh báo trước khi thay thế danh sách.

## 7. Công việc cần thực hiện

### Bước 1 — Chốt dữ liệu và migration

- Thêm `ma_lenh_sx text` vào `phieu_xuat_nhap_kho` và tạo index.
- Nên thêm `bang_tron_dinh_muc_id uuid` để biết chính xác phiếu định mức đã dùng.
- Cân nhắc unique hoặc trường `trang_thai/phien_ban` cho `bang_tron_vat_tu_dinh_muc` nếu một lệnh có thể có nhiều bản.
- Cập nhật `supabase-phieu-xuat-nhap-kho.sql` hoặc tạo migration riêng có thể chạy lại an toàn.

### Bước 2 — API lấy định mức theo Lệnh SX

- Mở rộng `GET /api/bang-tron-vat-tu-dinh-muc?ma_lenh_sx=...` với so sánh chính xác.
- Không dùng `q` để liên kết nghiệp vụ vì `q` là tìm kiếm chứa chuỗi, có thể khớp nhầm mã.
- Trả về dữ liệu đã chuẩn hóa hoặc bổ sung endpoint chuyên dụng, ví dụ:

```text
GET /api/phieu-xuat-nhap-kho/nvl-theo-lenh-sx?ma_lenh_sx=LSX-...
```

- Endpoint chuyên dụng nên đọc `bang_tron_vat_tu_dinh_muc`, flatten/gộp NVL và ghép danh mục `kho_nvl`.
- Response gồm: `dinh_muc_id`, `ma_lenh_sx`, `ma_npl`, `ten_npl`, `don_vi`, `dinh_muc_kg`, `he_so_kg`, `so_luong_goi_y`.
- Trả lỗi tiếng Việt rõ ràng cho trường hợp thiếu lệnh, không có định mức, nhiều bản không xác định hoặc JSON sai.

### Bước 3 — API lưu/sửa phiếu kho

- Bổ sung `maLenhSx/ma_lenh_sx` và `bangTronDinhMucId/bang_tron_dinh_muc_id` vào parser POST/PUT.
- Lưu hai trường trên cho tất cả dòng cùng `ma_phieu`.
- Validate mã lệnh tồn tại; nếu gửi `dinh_muc_id`, validate phiếu định mức thuộc đúng mã lệnh.
- Không tin `thanh_tien` từ FE; BE tiếp tục tính `so_luong × don_gia`.
- Nên lưu snapshot `quy_doi_kg` hoặc `he_so_kg` nếu báo cáo lịch sử phải giữ đúng kết quả tại thời điểm xuất; nếu không, dữ liệu cũ sẽ thay đổi khi `kho_nvl.Tổng kg` bị sửa.

### Bước 4 — Frontend tạo phiếu

- Tại Kho NVL + Phiếu xuất, khi chọn Lệnh SX gọi API định mức chính xác.
- Hiển thị trạng thái đang tải và khóa thao tác áp dụng trong lúc tải.
- Gộp và tự điền các dòng NVL; không tự điền Giá.
- Thêm/giữ các cột: Mã NPL, Tên NVL, ĐVT, Số lượng, Quy đổi kg, Giá, Thành tiền.
- Nên thêm cột phụ “Định mức (kg)” hoặc tooltip để người dùng so sánh số xuất với nhu cầu; đây không phải “Quy đổi kg”.
- Cho sửa Số lượng và Giá; Mã/tên/ĐVT từ danh mục nên chỉ đọc sau khi tự điền để tránh sai mã.
- Nếu người dùng chọn thêm nhiều lệnh, chỉ triển khai sau khi có quy tắc gộp được duyệt.

### Bước 5 — Frontend sửa, xem, in phiếu

- Khi sửa phiếu, tải lại `ma_lenh_sx` và `bang_tron_dinh_muc_id` đã lưu; không tự áp dụng lại định mức mới và ghi đè số lượng lịch sử.
- Chỉ tải lại NVL theo định mức khi người dùng chủ động đổi Lệnh SX và xác nhận thay dữ liệu.
- Hiển thị Mã lệnh SX trên màn xem chi tiết và bản in.
- Nếu có snapshot quy đổi, màn lịch sử/in dùng snapshot; dữ liệu mới chưa có snapshot mới dùng công thức hiện tại.

### Bước 6 — Kiểm thử

- Một lệnh có một phiếu định mức, một SP, nhiều NVL.
- Một mã NVL lặp ở nhiều SP và được gộp đúng khối lượng.
- Định mức `%` và định mức `kg` đều cho `khoi_luong` đúng.
- ĐVT xuất là kg, tấn, g và đơn vị khác có/không có `Tổng kg`.
- Người dùng sửa Số lượng: Quy đổi kg và Thành tiền cập nhật độc lập, đúng công thức.
- Không có định mức, có nhiều định mức, mã lệnh sai và JSON thiếu trường.
- Đổi Lệnh SX sau khi đã sửa dòng không làm mất dữ liệu mà không cảnh báo.
- Tạo, sửa, xem, in và xóa phiếu không làm sai tồn kho/lô nhập hiện có.
- Kiểm thử quyền tạo/sửa và toàn bộ lỗi hiển thị bằng tiếng Việt.

## 8. Tiêu chí nghiệm thu

- Chọn một Mã Lệnh SX hợp lệ sẽ hiện đúng danh sách NVL của Phiếu trộn định mức tương ứng.
- NVL trùng mã được gộp một dòng và tổng định mức kg đúng.
- Tên/ĐVT khớp danh mục `kho_nvl`.
- Số lượng và Giá cho phép nhập; Quy đổi kg và Thành tiền cập nhật tức thời.
- Quy đổi kg không sử dụng `san_pham_quy_doi` và không lấy từ báo cáo phối trộn.
- Phiếu đã lưu truy vết được Lệnh SX và Phiếu trộn định mức nguồn.
- Không có hệ số kg không tạo ra con số giả; người dùng nhận thông báo rõ ràng.

## 9. Các điểm cần nghiệp vụ xác nhận trước khi coding

1. Một phiếu xuất được chọn một hay nhiều Lệnh SX?
2. Một Lệnh SX có thể có nhiều Phiếu trộn định mức không; nếu có thì chọn bản nào?
3. Số lượng ban đầu để trống hay tự gợi ý từ `khoi_luong` định mức?
4. Có bắt buộc đủ hệ số quy đổi kg mới cho lưu phiếu không?
5. Có cần lưu snapshot `quy_doi_kg` để lịch sử không thay đổi khi danh mục NVL được cập nhật không?

