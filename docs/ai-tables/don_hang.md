# don_hang

| | |
|---|---|
| **Bảng** | `don_hang` |
| **Tab** | `orders` → `/don-hang` |
| **SQL** | `supabase-don-hang-*.sql` (bao gồm `supabase-don-hang-updated-at.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/don-hang` | 7475–7645 |

Helper parse/lưu JSON `san_pham` (kèm `stt`): ~4986–5550.
Helper bổ sung quy đổi theo cờ thay đổi từ form sửa: ~5376–5455.
Helper tự sinh mã: `generateNextOrderCodeFromDb()` ~2924.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/don-hang/index.tsx` | Panel / logic chính |
| `src/components/shared/Select2.tsx` | Select khách hàng (gõ để tìm) trên form thêm/sửa |
| `src/features/_shared/orderHelpers.ts` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Tạo lệnh SX: `POST /api/lenh-sx/from-don-hang/:id`

### Form đơn hàng

- **Khách hàng**: Select2 (gõ để tìm) lấy từ `/api/khach-hang` (bảng danh mục Khách hàng), bắt buộc chọn.
- **Sản phẩm JSON `san_pham`**: mỗi object có `stt` (1, 2, 3…) theo thứ tự dòng. Form thêm/sửa: kéo thả hoặc cụm action cố định `[Xóa] [↑] [↓]` bên phải; Lên/Xuống disabled ở đầu/cuối. Lưu luôn chuẩn hóa `stt` liên tục. Dữ liệu cũ chưa có `stt` hiển thị theo vị trí mảng.
- **Quy đổi khi thêm/sửa**: tải `san_pham_quy_doi`, áp dụng quy tắc nhóm VTHH và công thức tại `.ai/spec/tinh_toan_quy_doi.md`. Khi sửa, dòng chưa bị tác động hiển thị/giữ nguyên quy đổi trong JSON `san_pham`; chỉ tính theo bảng mới sau khi người dùng đổi dữ liệu ảnh hưởng quy đổi hoặc chọn lại sản phẩm cũ.
- Dòng JSON `san_pham` lưu mã AMIS, `ten_san_xuat`, `ten_ghep` và mảng `ket_qua_quy_doi`; thiếu cấu hình quy đổi vẫn cho phép lưu đơn.
- **`ten_ghep`**: luôn lưu cho mọi loại đơn, **lấy từ `ten_ghep` đã lưu trên danh mục SP** (`OrderProductOption.tenGhep`; thiếu mới ghép lại từ `ten_san_xuat`). Đơn cắt lẻ: nhóm **Đặc/Sóng** thay đúng token **m dài chính** (`doDaiM` trên SP) thành mét cắt (`replaceCutLengthMeters` — kể cả khi m dài không đứng cuối, vd `…6m - 2.1m` cắt 8m → `…8m - 2.1m`); các nhóm VTHH khác giữ luật cũ (thay token mét cuối, thiếu thì thêm `- Nm`). Danh sách, chi tiết và in đơn hàng hiển thị `ten_ghep` đã lưu; thiếu thì `formatProductionNameWithLength` ghép lại từ tên (tên tự do không parse được giữ nguyên). In đơn hàng và lệnh SX (thêm/sửa) hiển thị và lưu `ten_ghep`.
- **Ngày giao hàng**: cột `ngay_giao_hang`, migration `supabase-don-hang-ngay-giao-hang.sql`.
