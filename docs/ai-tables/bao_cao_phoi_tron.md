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

**Update ca:** Form sửa chuẩn hóa `ca` (bỏ `-`), khớp với sổ ca / cài đặt thời gian trước khi PATCH. API từ chối lưu nếu `ca` trống hoặc chỉ là `-`.
