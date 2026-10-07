# bao_cao_don_cat_le

| | |
|---|---|
| **Bảng** | `bao_cao_don_cat_le` |
| **Tab** | `bao-cao-don-cat-le` → `/bao-cao-don-cat-le` (card **Báo cáo đơn cắt lẻ** trong Kho `/nha-may/kho` và Sản xuất `/nha-may/cong-nhan`) |
| **SQL** | `supabase-bao-cao-don-cat-le.sql` |

## Vai trò

Danh sách + thêm mới báo cáo. Thêm mới tự điền sản phẩm từ `/api/lenh-cat-le`.
Mỗi sản phẩm có nút **Danh sách**: bên dưới là hai dòng ô nhập (Cắt và Còn lại).

Sản phẩm không lưu JSON cả dòng. Bảng `bao_cao_don_cat_le_san_pham`: mỗi sản phẩm nguồn, cắt, còn lại là một dòng với `ma_amis`, `ma_amis_cu`, `ten_san_pham`, `ten_san_xuat`. `chi_tiet` chỉ giữ số liệu kèm theo (SL, kg, m², dài, độ li, loại dòng).

## API (`server.ts`, ngay sau lệnh cắt lẻ)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/bao-cao-don-cat-le` | Danh sách |
| POST | `/api/bao-cao-don-cat-le` | Tạo, sinh `ma_bao_cao` |
| PUT | `/api/bao-cao-don-cat-le/:id` | Sửa |
| DELETE | `/api/bao-cao-don-cat-le/:id` | Xóa |

## File

- UI: `src/features/bao-cao-don-cat-le/index.tsx`
- Nguồn cắt: `src/features/lenh-cat-le/logic.ts` (`normalizeCatLeSanPhamList`)
