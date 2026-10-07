# thong_ke_nvl (Thống kê NVL)

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` (header + `chi_tiet` từng dòng) — không bảng mới |
| **Tab** | `thong-ke-nvl` → `/thong-ke-nvl` (card **Thống kê NVL** trong `/nha-may/kho`) |
| **DB** | Chính — label `he-thong` |

## API (`registerRoutes.ts` + `server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/xuat-nhap-tong-hop?from=&to=&limit=` | Lọc ngày server; máy/kho lọc client (đa chọn) |
| GET | `/api/danh-sach-may` | Options máy (`ma_may`) |
| GET | `/api/quan-ly-kho` | Options kho (`ten_kho`) |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/thong-ke-nvl/index.tsx` | `ThongKeNvlPanel`: lọc từ–đến ngày (`VnCalendarPicker`) + máy/kho đa chọn (`SearchableMultiSelect`, trống = tất cả), bảng 2 tầng Nhập/Xuất giống `/tong-hop-ncc` (thêm cột Kho + Máy), gộp theo tên NVL rồi liệt kê ngày, thanh tổng trên + dưới, xuất CSV |

## Quy ước lọc

- Bỏ phiếu `trang_thai = huy`; ngày phiếu trong `[from, to]`.
- Gọi API riêng nhập + xuất rồi gộp (API `order ngay desc + limit 2000` nên gọi chung dễ mất phiếu cũ trong kỳ dài).
- Mỗi dòng gom mọi chuỗi định danh (`collectLineTokens`: mọi cột id/tên nguồn-đích header + dòng, trừ số liệu), tra loại theo GIÁ TRỊ qua `buildPartyAliasKind` (`ma_may` + `ten_may` + `ten_kho`) — phiếu lưu máy bằng mã hay tên, ở cột kho hay cột máy đều khớp (`matchTokenFilter`, so khớp `foldPartyKey` bỏ dấu/hoa thường).
- Trống máy/kho = tất cả. Có chọn: dòng được giữ khi khớp ≥1 máy HOẶC ≥1 kho đã chọn (OR).
- Giá nhập kho dòng = đơn giá + chi phí đi kèm/1kg của phiếu (giống `tong-hop-ncc` + `ViewModal`).
