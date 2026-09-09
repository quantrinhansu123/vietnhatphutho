# ke_hoach_san_xuat

| **Bảng** | `ke_hoach_san_xuat` + `ke_hoach_san_xuat_dong` |
| **Tab** | `production-plan-history` → `/ke-hoach-san-xuat` |
| **SQL** | `supabase-ke-hoach-sx.sql`, `supabase-ke-hoach-san-xuat.sql` |

**API:** `server.ts` 6103–6305 — `GET/PUT/DELETE /api/ke-hoach-sx`
**UI:** `src/features/ke-hoach-san-xuat/index.tsx` — kế hoạch, chọn dòng, in QR, lịch sử
**Components:** `ProductionPlanNvlPrintSheet.tsx`, `ControlBoardShiftSummaryTable.tsx`  
**Utils:** `controlBoardShiftSummary.ts`, `controlBoardShiftSummaryDetails.ts`

## Xem trước khi in

- `src/features/ke-hoach-san-xuat/PrintPreviewModal.tsx` dùng cùng bố cục, màu sắc và bảng 14 cột với màn hình xem trước lệnh sản xuất.
- Dữ liệu gồm mã đơn hàng, tên sản xuất + quy cách mét, ĐVT, TL/cuộn, Tổng SX, phân bổ Bắc/Trung/Nam, TL/tấm, Tổng TL và Thực tế SX.
- Các trường Mã số, Ngày liên lạc, Đặc tả và Lần ban hành đều có thể sửa rồi lưu từ modal xem trước.
- `server.ts` `assembleProductionPlanPreviewRows` ưu tiên `san_pham[].ma_don_hang`, fallback `ke_hoach_san_xuat_dong.ma_don_hang` để không mất mã đơn hàng.
