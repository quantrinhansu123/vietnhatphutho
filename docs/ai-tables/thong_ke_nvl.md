# thong_ke_nvl (Thống kê NVL)

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` (header + `chi_tiet` từng dòng) — không bảng mới |
| **Tab** | `thong-ke-nvl` → `/thong-ke-nvl` (card **Thống kê NVL** trong `/nha-may/kho`) |
| **DB** | Chính — label `he-thong` |

## API (`registerRoutes.ts` + `server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/xuat-nhap-tong-hop?to=&loai=&paged=1&cursor=&limit=` | Phân trang theo `(ngay,id)` giảm dần, mỗi trang tối đa 500; đọc cả trước kỳ để tính tồn đầu. Không phân trang trả `truncated`. Máy/kho lọc client. |
| GET | `/api/danh-sach-may` | Options máy (`ma_may`) |
| GET | `/api/quan-ly-kho` | Options kho (`ten_kho`) |
| GET | `/api/cai-dat` | Danh sách ca sản xuất theo cài đặt |
| GET | `/api/so-tron?den_ngay=&usage=1&cursor=&limit=` | Phân trang `bang_ban_giao[].tong_su_dung`; tab tồn máy vẫn dùng ngày/ca/máy |
| GET | `/api/ton-kho-nvl?from=&to=&ten_kho=` | Nút kiểm tra tồn kho theo đơn giá trong tab Tồn & sử dụng; đọc `gia_ton[]`, tách “Chưa rõ giá”, chỉ kho vật lý, không gán giá cho máy/đợt |
| POST | `/api/xuat-nhap-tong-hop` | Nhập lại máy → kho; lưu giá từng dòng, kiểm tra tổng lượng theo Sổ trộn và giới hạn theo từng lớp mã + kho nguồn + đơn giá |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/thong-ke-nvl/index.tsx` | `ThongKeNvlPanel`: bốn tab Tổng quan, Chứng từ nhập–xuất (tab con Xuất/Nhập, mỗi tab một bảng toàn chiều rộng), Tồn & sử dụng theo chứng từ, Kiểm tra theo máy. Bộ lọc chung cho ba tab đầu chỉ áp dụng khi nhấn Xem; CSV dùng cùng snapshot. |
| `src/features/thong-ke-nvl/stockModel.ts` | Phân loại nguồn/đích từng dòng, số dư theo phạm vi kho/máy, khử trùng Sổ trộn; test `tests/unit/nvlStockModel.test.ts` |
| `src/features/thong-ke-nvl/MachineStockTab.tsx` | Lọc Sổ trộn theo ngày/ca và chọn một/nhiều máy hoặc tất cả; kiểm tra tồn cuối ca và theo dõi kho cấp/đơn giá, chỉ xem, không tạo phiếu nhập lại |
| `src/features/xuat-nhap-tong-hop/registerRoutes.ts` | Kiểm tra nhập lại từ máy theo Sổ trộn đã chọn, tổng lượng đã nhập trước đó và số dư từng lớp giá |
| `src/features/xuat-nhap-tong-hop/machineReturnPriceGroups.ts` | Tạo khóa và kiểm tra hạn mức nhập lại theo mã NVL + kho nguồn + đơn giá |

## Quy ước lọc

- Bỏ phiếu `trang_thai = huy`; ngày phiếu trong `[from, to]`.
- Gọi API riêng nhập + xuất, đọc hết trang có cursor; nếu trang lỗi, không xuất số liệu thiếu.
- Tồn chứng từ theo phạm vi: chuyển nội bộ kho↔máy không cộng hai lần khi chọn cả hai; sử dụng trừ tại máy một lần từ Sổ trộn. Lọc đợt: tồn đầu/nhập/xuất/tồn cuối tính từ chứng từ gắn đúng đợt (`excludeUsage`); cột Sử dụng ghi «Chưa trừ (lọc đợt)» vì sổ trộn không gắn đợt. Tab Kiểm tra theo máy đối chiếu tồn sổ với (cấp − nhập lại).
- Mỗi dòng gom mọi chuỗi định danh (`collectLineTokens`: mọi cột id/tên nguồn-đích header + dòng, trừ số liệu), tra loại theo GIÁ TRỊ qua `buildPartyAliasKind` (`ma_may` + `ten_may` + `ten_kho`) — phiếu lưu máy bằng mã hay tên, ở cột kho hay cột máy đều khớp (`matchTokenFilter`, so khớp `foldPartyKey` bỏ dấu/hoa thường).
- Trống máy/kho = tất cả. Có chọn: dòng được giữ khi khớp ≥1 máy HOẶC ≥1 kho đã chọn (OR).
- Giá nhập kho dòng = đơn giá + chi phí đi kèm/1kg của phiếu (giống `tong-hop-ncc` + `ViewModal`).
