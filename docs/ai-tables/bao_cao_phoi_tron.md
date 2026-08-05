# bao_cao_phoi_tron

| **Bảng** | `bao_cao_phoi_tron` |
| **Tab** | `mixing-report`, `mixing-report-list` |
| **SQL** | `supabase-bao-cao-phoi-tron.sql` |

**API:** `server.ts` 5284–5476  
**Components (đã tách):**
- `MixingReportForm.tsx` — nhập báo cáo
- `MixingReportListView.tsx` — danh sách + tab định mức
- `MixingNormMaterialsTab.tsx` — bảng trộn vật tư định mức (nhập tay)
- `MixingReportPrintSheet.tsx` — in
- `MixingOrderAutofillModal.tsx` — autofill

**Utils:** `lib/mixingReportModel.ts`, `utils/mixingOrderAutofill.ts`

Tab **Bảng trộn vật tư định mức** lưu bảng riêng `bang_tron_vat_tu_dinh_muc` — xem [bang_tron_vat_tu_dinh_muc.md](./bang_tron_vat_tu_dinh_muc.md).
