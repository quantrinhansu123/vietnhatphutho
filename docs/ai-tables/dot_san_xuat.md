# dot_san_xuat

| **Bảng** | `dot_san_xuat` |
| **Tab** | `dot-san-xuat` → `/dot-san-xuat` (Quản Đốc → Đợt sản xuất) |
| **SQL** | `supabase-dot-san-xuat.sql` |

**API:** `server.ts` dot-san-xuat routes — `GET /api/dot-san-xuat/preview?tu_ngay&den_ngay&ma_may`, `GET /api/dot-san-xuat/next-so`, `GET/POST/PUT/DELETE /api/dot-san-xuat`
**UI:** `src/features/dot-san-xuat/index.tsx` — Từ ngày → Đến ngày → Máy → tick lệnh SX, bảng phiếu xuất (TL/tiền chính-phụ từng phiếu), tổng tự động (sửa tay được), nhập tay thu hồi/hao hụt/nhân công, báo cáo định giá theo mẫu Excel đợt 4 T8/2026, nút **Xem trước bản in** (form + từng đợt đã lưu)
**In:** `src/features/dot-san-xuat/PrintPreviewModal.tsx` (`DotSanXuatPrintSheet` + `DotSanXuatPrintPreviewModal`) + CSS `.dot-san-xuat-print-*` trong `src/index.css`
**Components:** dùng chung `VnCalendarPicker`, `SearchableSelect`
**Utils:** `formatNumber`, `formatMoney`, `parseDateStr`/`formatDateVN` (so-che-do-may)

## Luồng

- Preview gom `lenh_sx` theo ngày bắt đầu + khớp máy, và `phieu_xuat_nhap_kho` (xuat/nvl) theo `ngay_phieu` + `may` rồi cộng `trong_luong_kg`/`thanh_tien` chia `nvl_chinh`/`nvl_phu` (fallback số lượng khi ĐVT kg, tiền = SL×đơn giá).
- Tên đợt tự gen `Đợt N tháng M/YYYY` theo tháng của Đến ngày + máy (`next-so` lấy max `dot_so` + 1).
- Công thức báo cáo: TL thực tế = chính − thu hồi − hao hụt (override tay được); đơn giá phụ = tiền phụ / TL thực tế; BQ = đơn giá tổng + đơn giá nhân công.
