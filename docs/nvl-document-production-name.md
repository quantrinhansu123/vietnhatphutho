# Chứng từ NVL chỉ lưu mã và tên sản xuất

Áp dụng phiếu nhập/xuất tổng hợp và vế kho NVL, phiếu định mức, phiếu trộn thực tế, sổ trộn và snapshot lịch sử. Danh mục `kho_nvl` vẫn giữ tên thương mại; dòng thành phẩm không bị xóa tên.

## Hợp đồng

- Dòng JSON không lưu `ten_nvl`/`tenNvl`/`materialName`; tên sản xuất vẫn là `ten_nvl_san_xuat` hoặc `ten_nvl_sx` theo nghiệp vụ.
- Phiếu kho JSON gắn `loai_danh_muc` để phân biệt NVL/thành phẩm, đồng thời giữ `material_id`. Vế kho giữ `id_danh_muc`; cột `ten_npl` của NVL được để trống, không drop cột dùng chung.
- Khóa đối chiếu ưu tiên ID. Khi thiếu ID, phải khớp duy nhất mã + tên sản xuất + kho; không dùng tên thương mại hay tự chọn dòng đầu tiên. Gộp lượng PTĐM để chọn giá vẫn theo mã + tên sản xuất, giữ quy tắc NVL chính/phụ và VTHH.
- `src/utils/nvlDocument.ts` chuẩn hóa serializer ở client và bảo vệ các INSERT/UPDATE tại transport Supabase của server, kể cả client cũ. Chỉ các bảng chứng từ được cấu hình chịu tác động; GET và danh mục không bị sửa.
- Snapshot lịch sử có ID danh mục đã bị thay/xóa vẫn giữ ID và tên sản xuất đã ghi, không gắn lại tùy tiện vào danh mục mới.

## Migration và khôi phục

1. `npm run migrate:nvl-document-names`: kiểm kê chỉ đọc, sao lưu vào `outputs/nvl-document-names-<timestamp>/`, ghi `changes.json`, `unresolved.json`.
2. Phải triển khai server bảo vệ ghi trước khi dọn DB. Chạy `npm run migrate:nvl-document-names -- --apply` khi báo cáo không còn vật liệu chưa xác định. Toàn bộ kế hoạch và backup được ghi trước thay đổi DB; số lượng, kg và tiền được đối chiếu trước/sau từng bản ghi.
3. Khi có xung đột phiên bản hoặc lỗi DB, dừng. `applied.json` ghi từng bản ghi đã đổi; không chạy lại thao tác phục hồi chồng lên phiếu vừa được người dùng sửa.
4. Khôi phục: `npm run migrate:nvl-document-names -- --restore outputs/nvl-document-names-<timestamp>`. Script kiểm tra các trường chưa thay đổi sau migration rồi phục hồi đúng các trường trong backup, không xóa/tạo lại phiếu và không động đến lượng tồn.

Backup chứa dữ liệu nghiệp vụ; giữ tại máy quản trị, không commit. Sau triển khai, tải lại trình duyệt để nhận phiên bản cache mới.

## Kiểm tra

`npx tsx --test tests/unit/nvlDocument.test.ts`

Kiểm tra tạo/sửa/in và chuỗi PTĐM → xuất kho → sổ trộn → bàn giao; cùng mã khác tên sản xuất/kho không bị nhận nhầm, bản ghi lịch sử đọc được khi danh mục gốc không còn.
