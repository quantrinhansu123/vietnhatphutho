# kho_nvl

| | |
|---|---|
| **Bảng** | `kho_nvl` |
| **Tab** | `materials` → `/kho-nvl` |
| **SQL** | `supabase-kho-nvl.sql`, `supabase-kho-nvl-ten-nvl-sx.sql`, `supabase-kho-nvl-rename-phan-loai.sql` |
| **Fix precision** | `supabase-kho-nvl-precision.sql` (giữ số lẻ, không bị làm tròn) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/kho-nvl` | 4605 |
| POST | `/api/kho-nvl` | 4633 |
| POST | `/api/kho-nvl/import-batch` | sau POST danh mục |
| POST | `/api/kho-nvl/fill-total-kg` | 4661 |
| PATCH | `/api/kho-nvl/:id` | 4713 |
| DELETE | `/api/kho-nvl/:id` | 4752 |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-nvl/index.tsx` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Phiếu xuất nhập (`phieu_xuat_nhap_kho`) cập nhật tồn kho NVL.

`ten_nvl_sx`: tên nguyên vật liệu sử dụng trong sản xuất; được sao chép sang thành phần NVL của sản phẩm khi chọn mã NPL.

### Excel danh mục NVL

- **Tải mẫu Excel** / **Tải Excel lên** — `src/utils/materialCatalogExcel.ts`
- Cột khớp bảng + form: Mã NPL, Tên, Tên NVL sản xuất, ĐV, **Phân loại**, Tổng kg, Tồn đầu, Nhập, Xuất, Kg nhựa/túi/lõi, Khổ cuộn, Chiều dài ĐV
- Ô trống vẫn đẩy lên (null); tạo mới hoặc cập nhật cần Mã + Tên; chỉ có Mã thì từ chối.
- Import phân loại theo `ma_npl` + `ten_npl` + `ten_nvl_sx`: đủ 3 trường thì match cả 3; mã + tên và tên SX trống thì match thêm `ten_nvl_sx` rỗng; chỉ có mã thì từ chối.
- Mẫu 2 cột cũ tách riêng: **Mẫu cập nhật Tổng kg** / **Nhập Tổng kg**
- **Phân loại**: Nguyên vật liệu phụ hoặc Nguyên vật liệu chính; vẫn nhận alias Excel cũ “Kho ngầm định”
