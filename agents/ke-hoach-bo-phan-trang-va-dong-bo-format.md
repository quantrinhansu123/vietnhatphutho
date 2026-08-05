# Kế hoạch: Bỏ phân trang toàn bộ + Đồng bộ format danh sách theo trang "Báo cáo tồn máy"

Ngày lập: 2026-08-05

## Mục tiêu
1. Bỏ phân trang (pagination) ở **tất cả** các trang danh sách trong ứng dụng.
2. Rà soát và liệt kê các trang danh sách chưa theo format nhóm **Ngày → Ca** giống trang tham chiếu `danh-sach-bao-cao-may-nvl-ton` (nhóm theo ngày, mỗi nhóm có header "NGÀY" + số phiếu + "TỔNG NGÀY", bảng con có cột "CA").

---

## Phần 1 — Danh sách các nơi cần bỏ phân trang

Toàn bộ pagination trong repo dùng chung module `src/components/shared/table/TablePagination.tsx`
(`TablePagination` component + hook `usePagination`), export qua `src/components/shared/table/index.ts`.

Cách bỏ ở mỗi vị trí: xoá state `currentPage`/`pageSize` (và biến tương đương), xoá lời gọi
`usePagination`/logic tự tính `totalPages` + cắt mảng thủ công, xoá block JSX `<TablePagination .../>`
và các `useEffect` reset trang khi filter đổi; render thẳng mảng đã lọc/đã nhóm thay vì mảng đã cắt trang.
Xoá import `TablePagination`/`usePagination` nếu không còn dùng. Sửa lại công thức STT nếu đang cộng theo
offset trang (`khach-hang`, `kiem-kho`).

### 1.1 Trang nhóm theo Ngày/Ca (đang phân trang theo nhóm ngày)
- [ ] `src/components/MachineNvlReportListView.tsx` (trang tham chiếu) — L36-38, 282-288, 488-496
- [ ] `src/components/MachineDowntimeReportListView.tsx` — L28-30, 228-229, 273-276, 583-588
- [ ] `src/components/AcceptanceReportListView.tsx` — L25-27, 270-271, 301-306, 724-729
- [ ] `src/components/MixingReportListView.tsx` — L51-53, 290-291, 322-325

### 1.2 Trang bảng phẳng (đang phân trang theo dòng)
- [ ] `src/features/kho-nvl/index.tsx` — L29, 788-789, 842-846, 853-854, 1229-1234
- [ ] `src/features/don-hang/index.tsx` — L37, 246-247, 546-550, 557-558, 928-933
- [ ] `src/features/san-pham/index.tsx` — L13, 1197-1198, 1608-1612, 1619-1620, 2061-2066
- [ ] `src/features/danh-sach-may/index.tsx` — L19, 255-256, 553-557, 564-565, 1063-1068
- [ ] `src/features/lenh-xuat-hang/index.tsx` — L17, 214-215, 272-276, 283-284, 479-484
- [ ] `src/features/khach-hang/index.tsx` — L18, 207-208, 422-426, 433-434, 752-757, 791 (STT phụ thuộc trang → cần sửa)
- [ ] `src/features/lenh-sx/index.tsx` — L13, 73-74, 225-229, 236-237, 358-363
- [ ] `src/features/nhan-su/index.tsx` — L27, 71-72, 228-232, 239-240, 480-485
- [ ] `src/features/cai-dat-thoi-gian/index.tsx` — **2 khối riêng**: bảng cài đặt (L23, 166-167, 382-394, 987-992) và bảng phân quyền (`permissionCurrentPage`/`permissionTotalPages`/`permissionPageSize`, L1161-1166)
- [ ] `src/features/kiem-kho/index.tsx` — `linePage`/`linePageSize`/`lineTotalPages`, state L180-181, logic L425-437, footer L628-636, STT L589 (STT phụ thuộc trang → cần sửa)

**Tổng: 15 vị trí phân trang cần xoá** (13 file đơn + 2 khối trong `cai-dat-thoi-gian`).

---

## Phần 2 — Đối chiếu format với trang tham chiếu

**Trang tham chiếu:** `src/components/MachineNvlReportListView.tsx` (route `/danh-sach-bao-cao-may-nvl-ton`).
Dữ liệu được nhóm bằng `buildMachineNvlReportGroups()` (`src/utils/machineNvlReports.ts:326`) theo
Ngày → Ca → Máy → phiếu. Mỗi nhóm ngày có header "NGÀY" + ngày + pill "X phiếu" + "TỔNG NGÀY" (tổng kg),
bảng con có cột **Ca**, Máy, Nhân sự, Giờ, Số NVL, Tổng (kg), Ghi chú, Thao tác (dùng `RowActionsMenu` chung).

### 2.1 Đã đúng format (nhóm Ngày/Ca giống trang tham chiếu)
| Trang | File |
|---|---|
| Báo cáo dừng máy | `src/components/MachineDowntimeReportListView.tsx` |
| Báo cáo sản lượng (nghiệm thu) | `src/components/AcceptanceReportListView.tsx` |
| Báo cáo phối trộn | `src/components/MixingReportListView.tsx` |

→ 4 trang này (gồm cả trang tham chiếu) chỉ cần xoá phân trang (Phần 1.1) là đạt chuẩn.

### 2.2 CHƯA đúng format — cần lên kế hoạch chuyển đổi
| Trang | File | Hiện trạng | Việc cần làm |
|---|---|---|---|
| Tổng hợp ca / Phiếu cân ca | `src/components/WeighingShiftSummary.tsx` | Nhóm theo **Ca**, không nhóm theo Ngày; không có "TỔNG NGÀY"; "Ngày" chỉ là cột phụ khi filter nhiều ngày | Đổi cấu trúc nhóm: Ngày → Ca (đảo thứ tự nhóm), thêm header "NGÀY"/"TỔNG NGÀY" |
| Lịch sử xuất nhập kho | `src/features/phieu-xuat-nhap-kho/index.tsx` (`WarehouseHistoryPanel`) | Bảng phẳng có cột "Ngày" nhưng không có section theo ngày, không có tổng theo ngày | Nhóm theo ngày kiểu section header + tổng ngày |
| Kế hoạch sản xuất (lịch sử) | `src/features/ke-hoach-san-xuat/index.tsx` (`ProductionPlanHistoryPanel`) | Master–detail: cột trái nhóm theo ngày nhưng chỉ hiện mã kế hoạch (không có "TỔNG NGÀY"); cột phải là bảng chi tiết phẳng có cột Ca nhưng không nhóm theo ngày | Bổ sung "TỔNG NGÀY" ở cột trái; xem xét nhóm lại bảng chi tiết theo ngày nếu áp dụng được |
| Nhật ký chạy máy | `src/components/MachineRunLogPanel.tsx` | Danh sách dạng card phẳng, không phải bảng, không nhóm theo ngày | Cân nhắc chuyển sang bảng nhóm theo Ngày/Ca nếu muốn đồng bộ |
| Nhân sự | `src/features/nhan-su/index.tsx` | Bảng phẳng, có phân trang | Không có khái niệm ngày/ca — có thể giữ nguyên dạng bảng phẳng (không bắt buộc nhóm ngày) sau khi bỏ phân trang |
| Danh sách xe | `src/features/danh-sach-xe/index.tsx` | Bảng phẳng, không phân trang, không nhóm | Không có khái niệm ngày/ca theo nghĩa báo cáo — xem xét có cần nhóm hay giữ bảng phẳng |
| Vận hành xe (chi phí, nhật ký, thu tiền, đối chiếu) | `src/features/danh-sach-xe/VehicleOperations.tsx` | Nhiều bảng phẳng, không nhóm theo ngày | Có dữ liệu theo ngày (nhật ký xe) — cân nhắc nhóm theo ngày nếu phù hợp nghiệp vụ |
| Sản phẩm | `src/features/san-pham/index.tsx` | Bảng phẳng, có phân trang | Danh mục sản phẩm, không có trục ngày/ca → giữ bảng phẳng |
| Danh sách máy | `src/features/danh-sach-may/index.tsx` | Bảng phẳng, có phân trang | Danh mục máy, không có trục ngày/ca → giữ bảng phẳng |
| Kho NVL | `src/features/kho-nvl/index.tsx` | Bảng phẳng, có phân trang | Danh mục vật tư, không có trục ngày/ca → giữ bảng phẳng |
| Đơn hàng | `src/features/don-hang/index.tsx` | Bảng phẳng, có phân trang | Có ngày đặt hàng — cân nhắc nhóm theo ngày nếu nghiệp vụ cần |
| Khách hàng | `src/features/khach-hang/index.tsx` | Bảng phẳng, có phân trang | Danh mục khách hàng, không có trục ngày/ca → giữ bảng phẳng |
| Lệnh xuất hàng | `src/features/lenh-xuat-hang/index.tsx` | Bảng phẳng, có phân trang | Có ngày xuất hàng — cân nhắc nhóm theo ngày |
| Lệnh sản xuất | `src/features/lenh-sx/index.tsx` | Bảng phẳng, có phân trang | Có ngày lệnh — cân nhắc nhóm theo ngày |
| Cài đặt / Phân quyền | `src/features/cai-dat-thoi-gian/index.tsx` | 2 bảng phẳng, có phân trang | Cấu hình hệ thống, không có trục ngày/ca → giữ bảng phẳng |
| Kiểm kho | `src/features/kiem-kho/index.tsx` | Bảng dòng vật tư trong 1 phiếu, có phân trang | Là bảng chi tiết trong 1 phiếu, không phải danh sách nhiều phiếu → giữ bảng phẳng |
| Quản lý kho | `src/features/quan-ly-kho/index.tsx` | Bảng phẳng, không phân trang | Danh mục kho, không có trục ngày/ca → giữ bảng phẳng |
| Định mức NVL (tab) | `src/components/MixingNormMaterialsTab.tsx` | Bảng phẳng, không phân trang | Danh mục định mức, không có trục ngày/ca → giữ bảng phẳng |

### 2.3 Không phải trang danh sách (bỏ qua)
`ControlBoardShiftDetailModal.tsx` (modal chi tiết 1 ca), `WeighingReportForm.tsx`, `MixingReportForm.tsx` (form tạo/sửa 1 phiếu).

---

## Đề xuất thứ tự thực hiện
1. **Bước 1 (làm ngay theo yêu cầu):** Xoá toàn bộ 15 vị trí phân trang ở Phần 1 — không đổi cấu trúc UI khác, chỉ bỏ pagination và render đầy đủ danh sách đã lọc/nhóm.
2. **Bước 2 (chờ xác nhận phạm vi):** Với các trang có trục ngày/ca thật sự (Tổng hợp ca, Lịch sử xuất nhập kho, Kế hoạch sản xuất, Nhật ký chạy máy, và có thể Đơn hàng/Lệnh xuất hàng/Lệnh sản xuất/Vận hành xe), chuyển sang format nhóm Ngày → header "NGÀY/X phiếu/TỔNG NGÀY" → bảng con có cột "Ca" giống trang tham chiếu.
3. Các trang thuộc danh mục thuần (không có trục ngày/ca: Nhân sự, Danh sách xe, Sản phẩm, Danh sách máy, Kho NVL, Khách hàng, Cài đặt/Phân quyền, Kiểm kho, Quản lý kho, Định mức NVL) giữ nguyên dạng bảng phẳng, chỉ cần bỏ phân trang.
