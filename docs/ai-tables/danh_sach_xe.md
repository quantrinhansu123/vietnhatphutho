# danh_sach_xe / doi_chieu_lai_xe / chi_phi_xe / nhat_ky_xe / yeu_cau_xuat_hang_xe

| **Bảng** | `danh_sach_xe`, `doi_chieu_lai_xe`, `chi_phi_xe`, `nhat_ky_xe`, `yeu_cau_xuat_hang_xe` |
| **Tab** | `vehicles` → `/danh-sach-xe` |
| **SQL** | `supabase-danh-sach-xe.sql` |

**API:**
- `server.ts` — `/api/danh-sach-xe`
- `server.ts` — `/api/doi-chieu-lai-xe`
- `server.ts` — `/api/chi-phi-xe`
- `server.ts` — `/api/nhat-ky-xe`
- `server.ts` — `/api/yeu-cau-xuat-hang-xe`

**UI:** `src/features/danh-sach-xe/index.tsx`, `src/features/danh-sach-xe/VehicleOperations.tsx`, `src/features/danh-sach-xe/DriverPolicy.tsx`

Tab `Quy chế lái xe` (`DriverPolicy.tsx`) là nội dung tĩnh, không có bảng/API — QĐ 220222 CN/QĐ (22/02/2022) để nhân sự & lái xe đọc lại.

Dữ liệu gốc `danh_sach_xe`: loại xe, biển số, tài xế phụ trách.  
Dữ liệu tháng `doi_chieu_lai_xe`: công quy đổi, chuyến, km, các khoản thưởng và doanh số.
Chi phí `chi_phi_xe`: ngày giờ, loại/tên chi phí, số tiền, BSX, nhân viên và ảnh hóa đơn.
Nhật ký `nhat_ky_xe`: ngày giờ, ca, BSX, nhân viên, tổng mặt hàng, doanh thu và chi phí.
