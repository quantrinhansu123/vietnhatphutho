# phieu_chuyen_kho

| | |
|---|---|
| **Bảng** | `phieu_chuyen_kho` |
| **Tab** | `chuyen-kho` → `/chuyen-kho` (card **Chuyển kho** trong `/nha-may/kho`) |
| **SQL** | `supabase-phieu-chuyen-kho.sql` |

## Vai trò

Chuyển SP qua lại giữa các kho thành phẩm (TP ↔ cắt lẻ ↔ tái chế...).
1 phiếu CK (`CK-...`) hoàn thành sinh đúng 2 phiếu XN: xuất (kho nguồn) + nhập (kho đích).
Hủy phiếu đã hoàn thành sinh thêm 2 phiếu đảo (lý do `Hủy chuyển kho ...`).
**Không có xóa** — hủy nháp chỉ đổi trạng thái.

- Chỉ nhận kho SP (chặn kho vật tư `nvl/nguyên vật liệu`).
- Dòng SP giữ nguyên mã/tên/hệ số + 7 thông số ghép tên → catalog đích cắt tiếp được.
- Tồn đối soát tại **đúng kho nguồn** (`strictKho=1` + khớp alias TP, trống = Kho thành phẩm).

## API (`server.ts`, sau `lenh-cat-le`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/chuyen-kho` (?trang_thai) | Danh sách mới nhất trước |
| POST | `/api/chuyen-kho` | Tạo nháp (`moi`), `chi_tiet[]` JSON |
| PUT | `/api/chuyen-kho/:id` | Sửa nháp `moi`. Đã hoàn thành/hủy thì từ chối |
| POST | `/api/chuyen-kho/:id/hoan-thanh` | Đối soát tồn nguồn → 2 phiếu (rollback nếu phiếu sau lỗi) → catalog đích → `hoan_thanh` |
| POST | `/api/chuyen-kho/:id/huy` | Nháp → `huy` luôn; đã hoàn thành → đối soát tồn đích → 2 phiếu đảo → `huy` |

`GET /api/nhap-kho` hỗ trợ `strictKho=1`: chỉ tính hàng đúng kho (danh mục + phiếu đều lọc,
khớp alias TP) — màn này và Lệnh cắt dùng để chọn hàng nguồn. Mặc định không lọc (view cũ).

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/chuyen-kho/index.tsx` | Panel: modal large (ngày + nguồn/đích + người TH/lập + bảng SP Mã/Tên/ĐVT/tồn/SL/KG/M2/M dài) + danh sách + sửa nháp/Duyệt/hủy + in 2 phiếu. Đã Duyệt (`hoan_thanh`) thì không sửa |

## Không đọc

`App.monolith.backup.tsx` — logic phiếu TP xem [phieu_xuat_nhap_kho.md](./phieu_xuat_nhap_kho.md).
