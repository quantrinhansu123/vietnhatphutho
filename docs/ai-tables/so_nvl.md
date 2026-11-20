# so_nvl (phieu_nhap_kho_nvl + nhap_kho_nvl + ma_luong_nvl)

| | |
|---|---|
| **Bảng** | `phieu_nhap_kho_nvl` (header, nhập/xuất qua `loai_phieu`), `nhap_kho_nvl` (dòng, nối bằng `phieu_nk` = `ma_phieu`), `ma_luong_nvl` (danh mục mã luồng MN01/SX01/HM05… chỉ là nhãn) |
| **Tab** | `so-nvl` → `/so-nvl` (card **Sổ NVL (có duyệt)** trong `/nha-may/kho`) |
| **SQL** | `supabase-phieu-nvl-kiem-soat.sql` (idempotent) |

## Kiểm soát phiếu

- Trạng thái `nhap` → `da_duyet` → `huy`. Chỉ phiếu `nhap` sửa được; trigger SQL chặn sửa dòng/header khi đã duyệt (chỉ cho hủy).
- Duyệt = hàm SQL `duyet_phieu_nvl(id, nguoi)`: phiếu xuất bị chặn nếu vượt tồn (kho + mã NVL + tên SX). Hủy = `huy_phieu_nvl(id, nguoi, ly_do)`; phiếu hủy không tính vào tồn.
- Tồn = view `v_ton_kho_nvl` (chỉ phiếu `da_duyet`). `log` jsonb ghi tạo/sửa/duyệt/hủy.
- **Không** ràng buộc cặp mã luồng (SX01→SX02…): người dùng tự chọn. Loại SP chạy `dac`/`song`/`rong` thay cho phân xưởng.
- Chưa có FIFO theo lô giá trên bảng này (cột `id_dong_nhap_nguon` đã sẵn). Bảng cũ `phieu_nhap_kho`/`phieu_nhap_xuat_tong_hop` giữ nguyên để đọc lịch sử.

## API (`serverPhieuNvl.ts`, đăng ký trong `server.ts` sau `registerDataAdminRoutes`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/phieu-nvl?from&to&loai_phieu&trang_thai` | Kèm `lines`, tối đa 500 phiếu |
| POST | `/api/phieu-nvl` | Tạo nháp, sinh `NK-/XK-YYMMDD-NNN` |
| PUT | `/api/phieu-nvl/:id` | Sửa nháp (thay toàn bộ dòng), không đổi loại |
| POST | `/api/phieu-nvl/:id/duyet`, `/huy` | Hủy bắt buộc `ly_do` |
| GET | `/api/phieu-nvl/ton?ten_kho=` | Từ `v_ton_kho_nvl` |
| GET | `/api/phieu-nvl/luong-kho?from&to` | Luồng giữa các kho: phiếu đã duyệt có đủ `kho_nguon` + `kho_dich`, gộp theo cặp kho và loại phiếu. Xuất = phiếu xuất "Xuất đến kho", nhận = phiếu nhập "Nhập từ kho"; chênh lệch = xuất − nhận |
| GET/POST | `/api/ma-luong-nvl` | POST là upsert theo `ma` |

## Frontend

`src/features/so-nvl/index.tsx` — 4 tab: Phiếu (lọc + lập/sửa/duyệt/hủy), Tồn kho, **Luồng kho** (xuất đi / kho đích đã nhận / chênh lệch theo cặp kho), Mã luồng. Form có ô tùy chọn "Nhập từ kho" (phiếu nhập) hoặc "Xuất đến kho" (phiếu xuất); bỏ trống = nhập ngoài / xuất cho sản xuất, không vào luồng kho. Server chặn kho nguồn trùng kho đích. NVL chọn theo đúng kho từ `/api/kho-nvl?ten_kho=`.
