# bang_tron_vat_tu_dinh_muc

| **Bảng** | `bang_tron_vat_tu_dinh_muc` |
| **Tab** | trong `/danh-sach-bao-cao-phoi-tron` → tab **Bảng trộn vật tư định mức** |
| **SQL** | `supabase-bang-tron-vat-tu-dinh-muc.sql` |

**API:** `server.ts` — `/api/bang-tron-vat-tu-dinh-muc` (GET/POST/PATCH/DELETE)  
**UI:** `src/components/MixingNormMaterialsTab.tsx` (nhúng trong `MixingReportListView.tsx`)

Nhập tay theo **phiếu**: Ngày, Tổng trọng lượng (kg), Ghi chú + nhiều dòng NVL (`ma_nvl`, `ten_nvl`, `gia_tri`, `don_vi`) lưu `chi_tiet` jsonb. Không còn bắt buộc Mã/Tên SP.
