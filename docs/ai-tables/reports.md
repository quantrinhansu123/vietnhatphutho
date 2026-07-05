# reports

| **Bảng** | `reports` |
| **Tab** | `form` → `/nhap-bao-cao` |
| **SQL** | `supabase-reports.sql` |

**API:** `server.ts` 3440–3505, reset 5835  
**UI:** `src/App.tsx` **17658–17767** — wizard 3 bước  
**Components:**
- `ShiftInfoForm.tsx` — bước 1
- `ProductEntryForm.tsx` — bước 2
- `MaterialsForm.tsx`, `WasteForm.tsx` — bước 3

**Types:** `src/types.ts` — `ProductionReport`, `ShiftInfo`, …  
**Utils:** `src/utils.ts` — `computeReportMetrics`

Legacy báo cáo sản lượng ca tổng hợp.
