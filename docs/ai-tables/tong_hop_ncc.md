# tong_hop_ncc (Tổng hợp NVL từ nhà cung cấp)

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` (header) + `nha_cung_cap` (danh mục NCC) |
| **Tab** | `tong-hop-ncc` → `/tong-hop-ncc` (card **Tổng hợp NVL từ nhà cung cấp** trong `/nha-may/kho`) |
| **DB** | Chính — label `he-thong` |

## API (`registerRoutes.ts` + `server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/xuat-nhap-tong-hop?from=&to=&ncc=&limit=` | Lọc ngày + NCC (`nguon_id`/`dich_id`), `limit` tối đa 2000 |
| GET | `/api/nha-cung-cap` | Danh mục NCC cho ô chọn |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/tong-hop-ncc/index.tsx` | `TongHopNccPanel`: lọc từ–đến ngày (VnCalendarPicker) + NCC, bảng 2 tầng (Liên quan đến nhập / trả NCC), gộp theo tên NVL rồi liệt kê ngày bên dưới, thanh tổng trên + dưới bảng, xuất CSV |
| `src/features/xuat-nhap-tong-hop/index.tsx` | Phiếu xuất loại “Xuất cho trả lại Nhà cung cấp …” có ô **Nhà cung cấp trả lại** dưới danh sách chi tiết (`xuatNccId` → `dich_dong_loai=ncc`) |
| `src/features/xuat-nhap-tong-hop/model.ts` | `LOAI_NHAP_OPTIONS[0]` = Nhập kho từ Nhà cung cấp, `LOAI_XUAT_TRA_NCC` = Xuất trả NCC |

## Quy ước lọc

- Nhập: `loai=nhap`, `loai_nhap=Nhập kho từ Nhà cung cấp`, `nguon_loai=ncc` (+ `nguon_id` = NCC đã chọn).
- Trả: `loai=xuat`, từng dòng `dich_dong_loai=ncc` (+ `dich_dong_id` = NCC đã chọn).
- Tên NVL hiển thị gộp Kho NVL Chính / Phụ / PC (không tách theo kho); `ten_nvl_sx` trống thì dùng tên hàng.
- Giá nhập kho dòng = đơn giá + chi phí đi kèm/1kg của phiếu (giống `ViewModal`).
