# control_board (bảng điều khiển)

Tab `control-board` → `/bang-dieu-khien` — **đọc nhiều bảng**, không có bảng riêng.

## UI

| File | Dòng / vai trò |
|------|----------------|
| `src/App.tsx` **14838–16024** | `ControlBoardPanel` |
| `ControlBoardShiftSummaryTable.tsx` | Bảng tổng hợp ca |
| `ControlBoardShiftDetailModal.tsx` | Chi tiết ca |
| `ControlBoardShiftSummaryPrintSheet.tsx` | In tổng hợp |

## Utils

`controlBoardShiftSummary.ts` — tổng hợp từ phiếu cân, kho, NVL.

## Bảng liên quan

`phieu_can_dinh_ki`, `kho_nvl`, `phieu_xuat_nhap_kho`, `ke_hoach_san_xuat`, `nhan_su`, `don_hang`, `san_pham`, `danh_sach_may`

Khi sửa bảng điều khiển: đọc manifest từng bảng con trước.
