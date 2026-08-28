# don_hang

| | |
|---|---|
| **Bảng** | `don_hang` |
| **Tab** | `orders` → `/don-hang` |
| **SQL** | `supabase-don-hang-*.sql` (bao gồm `supabase-don-hang-updated-at.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/don-hang` | 6946–7093 |

Helper parse/lưu JSON `san_pham` (kèm `stt`): ~4781–5083.
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
- **Quy đổi khi thêm/sửa**: tải `san_pham_quy_doi`, áp dụng quy tắc nhóm VTHH và công thức tại `.ai/spec/tinh_toan_quy_doi.md`.
- Dòng JSON `san_pham` lưu mã AMIS, `ten_san_xuat` và mảng `ket_qua_quy_doi`; thiếu cấu hình quy đổi vẫn cho phép lưu đơn.
- **Ngày giao hàng**: cột `ngay_giao_hang`, migration `supabase-don-hang-ngay-giao-hang.sql`.
