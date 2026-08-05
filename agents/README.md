# Chuẩn giao diện bảng dữ liệu và bộ lọc

Mục tiêu: dùng trang **Lệnh sản xuất** (`/lenh-san-xuat`,
`src/features/lenh-sx/index.tsx`) làm chuẩn chung cho các màn hình danh sách:+

- Bộ lọc gọn trên một hàng, ô tìm kiếm đặt trước.
- Header bảng nền đen, chữ trắng.
- Badge trạng thái thống nhất.
- Danh sách dài có phân trang và chọn số bản ghi mỗi trang.
- Giữ nguyên nghiệp vụ, API, bảng nhập liệu, bảng chi tiết modal và mẫu in.

## Thành phần dùng chung

Thư mục: `src/components/shared/table/`

| File | Nội dung |
|---|---|
| `TableToolbar.tsx` | `TableToolbar`, `TableSearchInput`, `TableDateFilter` |
| `FilterCombobox.tsx` | Dropdown chọn một giá trị, tùy chọn tìm kiếm |
| `MultiSelectFilter.tsx` | Dropdown checkbox chọn nhiều giá trị |
| `TableShell.tsx` | Khung bảng, header, body, row và empty row |
| `TablePagination.tsx` | Footer phân trang và hook `usePagination` |
| `StatusBadge.tsx` | Badge trạng thái dùng chung |
| `index.ts` | Barrel export |

Import mẫu:

```tsx
import {
  TableToolbar, TableSearchInput, TableDateFilter,
  FilterCombobox, MultiSelectFilter,
  TableShell, TableHead, TableHeadCell, TableBody, TableRow, TableEmptyRow,
  TablePagination, usePagination, StatusBadge
} from '../../components/shared/table';
```

Khi render `TableRow`, đặt `key` trên `React.Fragment`:

```tsx
{rows.map(row => (
  <React.Fragment key={row.id}>
    <TableRow>{/* cells */}</TableRow>
  </React.Fragment>
))}
```

## Trạng thái áp dụng

### Danh mục, đơn hàng và vận hành chính

- [x] Lệnh sản xuất — `src/features/lenh-sx/index.tsx`
- [x] Kế hoạch sản xuất — `src/features/ke-hoach-san-xuat/index.tsx`
  - Lịch sử kế hoạch có tìm kiếm và phân trang theo ngày; chi tiết có phân trang.
  - Preview QR, định mức NVL, bảng kéo-thả lập kế hoạch và chi tiết modal chỉ đồng bộ header;
    không phân trang vì đây là bảng thao tác/preview, không phải danh sách CRUD.
- [x] Sản phẩm — `src/features/san-pham/index.tsx`
- [x] Đơn hàng — `src/features/don-hang/index.tsx`
- [x] Khách hàng — `src/features/khach-hang/index.tsx`
- [x] Danh sách máy — `src/features/danh-sach-may/index.tsx`
- [x] Cài đặt thời gian và phân quyền — `src/features/cai-dat-thoi-gian/index.tsx`,
  `src/features/cai-dat-thoi-gian/RolePermissionsMatrix.tsx`
- [x] Lệnh xuất hàng — `src/features/lenh-xuat-hang/index.tsx`
- [x] Nhân sự — `src/features/nhan-su/index.tsx`

### Kho và kiểm kê

- [x] Kho NVL — `src/features/kho-nvl/index.tsx`
- [x] Phiếu xuất/nhập kho — `src/features/phieu-xuat-nhap-kho/index.tsx`
- [x] Kiểm kho — `src/features/kiem-kho/index.tsx`
- [x] Quản lý kho — `src/features/quan-ly-kho/index.tsx`
- [x] Cân tự động — `src/features/can-tu-dong/index.tsx`

### Xe và vận hành xe

- [x] Danh sách xe — `src/features/danh-sach-xe/index.tsx`
- [x] Yêu cầu giao hàng — `src/features/danh-sach-xe/VehicleOperations.tsx`
- [x] Chi phí xe — tìm kiếm/lọc, header chuẩn và phân trang.
- [x] Nhật ký xe — bổ sung tìm kiếm, header chuẩn và phân trang.
- [x] Nhật ký KM — bổ sung tìm kiếm, header chuẩn và phân trang.
- [x] Thu tiền khách hàng — tìm kiếm/lọc, header chuẩn và phân trang.
- [x] Chính sách tài xế — `src/features/danh-sach-xe/DriverPolicy.tsx`

### Báo cáo và dashboard

- [x] Danh sách báo cáo sản lượng — `src/components/AcceptanceReportListView.tsx`
- [x] Danh sách báo cáo dừng máy — `src/components/MachineDowntimeReportListView.tsx`
- [x] Danh sách báo cáo phối trộn — `src/components/MixingReportListView.tsx`
- [x] Danh sách báo cáo máy NVL tồn — `src/components/MachineNvlReportListView.tsx`
- [x] Bảng điều khiển — `src/features/control-board/index.tsx`
  - Giữ bộ lọc realtime hiện có và đồng bộ header bảng; không thêm pager vào bảng theo dõi realtime.

## Ngoài phạm vi

- `src/App.monolith.backup.tsx`: code lưu trữ cũ, không mở hoặc chỉnh sửa.
- Các `*PrintSheet.tsx`, `WarehouseSlipPrintModal.tsx`: mẫu in.
- Bảng nhập liệu/xem nhanh trong form hoặc modal: không bắt buộc tìm kiếm và phân trang.
- Không thay đổi API, schema hoặc migration trong đợt chuẩn hóa giao diện này.

## Quy trình kiểm tra

1. Xác nhận tìm kiếm và bộ lọc vẫn dùng đúng dữ liệu cũ.
2. Xác nhận phân trang dùng danh sách **sau khi lọc**.
3. Kiểm tra desktop, mobile và trạng thái không có dữ liệu.
4. Chạy `npx tsc --noEmit`.
5. Chạy build ứng dụng trước khi bàn giao.

## Kết quả hiện tại

- Bộ component bảng dùng chung: hoàn thành.
- Toàn bộ màn hình trong checklist: đã áp dụng.
- TypeScript: đã kiểm tra sạch sau từng nhóm thay đổi.
- Không chỉnh sửa backend, database hoặc file monolith backup.
