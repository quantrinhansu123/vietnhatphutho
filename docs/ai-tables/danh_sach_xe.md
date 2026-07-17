# danh_sach_xe / doi_chieu_lai_xe / chi_phi_xe / nhat_ky_xe

| **Bảng** | `danh_sach_xe`, `doi_chieu_lai_xe`, `chi_phi_xe`, `nhat_ky_xe` |
| **Tab** | `vehicles` → `/danh-sach-xe` |
| **SQL** | `supabase-danh-sach-xe.sql` |

**API:**
- `server.ts` — `/api/danh-sach-xe`
- `server.ts` — `/api/doi-chieu-lai-xe`
- `server.ts` — `/api/chi-phi-xe`
- `server.ts` — `/api/nhat-ky-xe`

**UI:** `src/features/danh-sach-xe/index.tsx`, `src/features/danh-sach-xe/VehicleOperations.tsx`

Dữ liệu gốc `danh_sach_xe`: loại xe, biển số, tài xế phụ trách.  
Dữ liệu tháng `doi_chieu_lai_xe`: công quy đổi, chuyến, km, các khoản thưởng và doanh số.
Chi phí `chi_phi_xe`: ngày giờ, loại/tên chi phí, số tiền, BSX, nhân viên và ảnh hóa đơn.
Nhật ký `nhat_ky_xe`: ngày giờ, ca, BSX, nhân viên, tổng mặt hàng, doanh thu và chi phí.
