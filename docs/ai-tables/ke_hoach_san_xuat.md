# ke_hoach_san_xuat

| **Bảng** | `ke_hoach_san_xuat` + `ke_hoach_san_xuat_dong` |
| **Tab** | `production-plan-history` → `/ke-hoach-san-xuat` |
| **SQL** | `supabase-ke-hoach-sx.sql`, `supabase-ke-hoach-san-xuat.sql` |

**API:** `server.ts` 6103–6305 — `GET/PUT/DELETE /api/ke-hoach-sx`
**UI:** `src/features/ke-hoach-san-xuat/index.tsx` — kế hoạch, chọn dòng, in QR, lịch sử
**Components:** `ProductionPlanNvlPrintSheet.tsx`, `ControlBoardShiftSummaryTable.tsx`  
**Utils:** `controlBoardShiftSummary.ts`, `controlBoardShiftSummaryDetails.ts`
