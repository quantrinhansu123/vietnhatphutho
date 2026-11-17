# ke_hoach_san_xuat

| **Bảng** | `ke_hoach_san_xuat` + `ke_hoach_san_xuat_dong` |
| **Tab** | `production-plan-history` → `/ke-hoach-san-xuat` |
| **SQL** | `supabase-ke-hoach-sx.sql`, `supabase-ke-hoach-san-xuat.sql`, `supabase-ke-hoach-san-xuat-dong-ptdm-sl.sql` |

**API:** `server.ts` — `GET/PUT/DELETE /api/ke-hoach-sx`
**UI:** `src/features/ke-hoach-san-xuat/index.tsx` — kế hoạch, SL ngày, PTĐM, in QR, lịch sử  
**Helpers:** `src/features/ke-hoach-san-xuat/ptdmPlanHelpers.ts`  
**Components:** `ProductionPlanNvlPrintSheet.tsx`, `ControlBoardShiftSummaryTable.tsx`  
**Utils:** `controlBoardShiftSummary.ts`, `controlBoardShiftSummaryDetails.ts`

## SL ngày + PTĐM

- Mỗi dòng lệnh: JSON `san_pham[]` có `so_luong` (SL kế hoạch ngày), `so_luong_lenh`, `so_luong_da_sx`.
- Form tạo chỉ hiện lệnh trạng thái `Chờ sx`, lọc theo ca; `so_luong` = tổng SLSX Bắc + Trung + Nam.
- **Đã SX** gợi ý từ **sổ trộn** (`GET /api/so-tron?ngay=` → `bang_san_pham`), không dùng nhập kho / nghiệm thu. Nút «Lấy đã SX từ sổ trộn»; cho sửa tay.
- `so_luong_con_lai = so_luong - so_luong_da_sx`.
- Cột `danh_sach_ptdm` jsonb: nhiều phiếu PTĐM / dòng; mỗi phần tử `{ dinh_muc_id, ten_phieu, thoi_gian_gan, so_luong_ap_dung_theo_sp }`.
- Hết NVL → tạo PTĐM mới (module định mức) → **sửa** KHSX thêm phiếu (không làm lại cả KH). Server stamp `thoi_gian_gan` khi thêm.
- In NVL: bắt buộc ≥ 1 PTĐM; đổi SL áp dụng của SP ra kg (ĐVT/TL cuộn/TL tấm/quy đổi KG), rồi scale tổng NVL theo tổng trọng lượng PTĐM; nếu thiếu tổng PTĐM thì scale theo định lượng 1 cối. Fallback BOM catalog nếu không khớp SP.

## Xem trước khi in

- Kế hoạch SX **không** thay lệnh SX: là phần theo **ngày** của lệnh + PTĐM đã gắn.
- `PrintPreviewModal.tsx`: bảng **sản phẩm** (SL/TL thành phẩm) + bảng **vật tư theo PTĐM** (scale từ `chi_tiet` theo SL áp dụng / ca).
- `server.ts` `assembleProductionPlanPreviewRows` ưu tiên `san_pham[].ma_don_hang`, fallback `ke_hoach_san_xuat_dong.ma_don_hang`.
- Helper gom NVL: `loadAggregatedPlanMaterialsFromPtdm` trong `ptdmPlanHelpers.ts`.
