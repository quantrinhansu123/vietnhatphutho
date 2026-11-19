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
| GET | `/api/cai-dat` | Danh sách ca sản xuất theo cài đặt |
| GET | `/api/so-tron?ngay=&ca=&ma_may=&limit=` | Tồn cuối máy theo ngày, ca, máy; lấy `bang_ban_giao[].ton_cuoi_ca` |
| POST | `/api/xuat-nhap-tong-hop` | Nhập lại máy → kho; lưu giá từng dòng, kiểm tra tổng lượng theo Sổ trộn và giới hạn theo từng lớp mã + kho nguồn + đơn giá |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/thong-ke-nvl/index.tsx` | `ThongKeNvlPanel`: tab Nhập–xuất và tab Kiểm tra tồn theo máy |
| `src/features/thong-ke-nvl/MachineStockTab.tsx` | Lọc Sổ trộn theo ngày/ca và chọn một/nhiều máy hoặc tất cả; kiểm tra tồn cuối ca và theo dõi kho cấp/đơn giá, chỉ xem, không tạo phiếu nhập lại |
| `src/features/xuat-nhap-tong-hop/registerRoutes.ts` | Kiểm tra nhập lại từ máy theo Sổ trộn đã chọn, tổng lượng đã nhập trước đó và số dư từng lớp giá |
| `src/features/xuat-nhap-tong-hop/machineReturnPriceGroups.ts` | Tạo khóa và kiểm tra hạn mức nhập lại theo mã NVL + kho nguồn + đơn giá |

## Quy ước lọc

- Bỏ phiếu `trang_thai = huy`; ngày phiếu trong `[from, to]`.
- Gọi API riêng nhập + xuất rồi gộp (API `order ngay desc + limit 2000` nên gọi chung dễ mất phiếu cũ trong kỳ dài).
- Mỗi dòng gom mọi chuỗi định danh (`collectLineTokens`: mọi cột id/tên nguồn-đích header + dòng, trừ số liệu), tra loại theo GIÁ TRỊ qua `buildPartyAliasKind` (`ma_may` + `ten_may` + `ten_kho`) — phiếu lưu máy bằng mã hay tên, ở cột kho hay cột máy đều khớp (`matchTokenFilter`, so khớp `foldPartyKey` bỏ dấu/hoa thường).
- Trống máy/kho = tất cả. Có chọn: dòng được giữ khi khớp ≥1 máy HOẶC ≥1 kho đã chọn (OR).
- Giá nhập kho dòng = đơn giá + chi phí đi kèm/1kg của phiếu (giống `tong-hop-ncc` + `ViewModal`).
