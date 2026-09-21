# dot_san_xuat

| **Bảng** | `dot_san_xuat` |
| **Tab** | `dot-san-xuat` → `/dot-san-xuat` (Quản Đốc → Đợt sản xuất) |
| **SQL** | `supabase-dot-san-xuat.sql` |

**API:** `server.ts` dot-san-xuat routes — `GET /api/dot-san-xuat/preview?tu_ngay&den_ngay&ma_may`, `GET /api/dot-san-xuat/next-so`, `GET/POST/PUT/DELETE /api/dot-san-xuat`
**UI:** `src/features/dot-san-xuat/index.tsx` — Từ ngày → Đến ngày → Máy → 2 bảng chỉ xem (lệnh SX + phiếu xuất đúng phạm vi ngày/máy, không tick chọn), tổng vật tư tự động (sửa tay được), báo cáo xem trước giống mẫu Excel (sửa trực tiếp thu hồi/hao hụt/TL thực tế/số công/chi phí ngay trong bảng), nút **Xem trước bản in** (form + từng đợt đã lưu)
**So sánh đợt trước:** API trả `dot_truoc` kèm `don_gia_chinh/phu/chinh_thuc_te/tong/nhan_cong` tính sẵn từ đợt đã lưu
**In:** `src/features/dot-san-xuat/PrintPreviewModal.tsx` (`DotSanXuatPrintSheet` + `DotSanXuatPrintPreviewModal`) + CSS `.dot-san-xuat-print-*` trong `src/index.css`
**Components:** dùng chung `VnCalendarPicker`, `SearchableSelect`
**Utils:** `formatNumber`, `formatMoney`, `parseDateStr`/`formatDateVN` (so-che-do-may)

## Luồng

- Preview gom `lenh_sx` MỌI trạng thái theo ngày (bắt đầu/kết thúc giao khoảng) + khớp máy (mã/tên), đối chiếu `so_tron` cùng phạm vi để gắn cờ `co_so_tron` (lệnh có SX thực tế) + `hoan_thanh`; cảnh báo khi có phiếu xuất mà chưa có lệnh hoàn thành/sổ trộn. Tổng vật tư luôn tính từ `phieu_xuat_nhap_kho` (xuat/nvl) nên không sai khi lệnh chưa chuyển trạng thái.
- Nhập tay: thu hồi (TL/tiền), hao hụt, TL thực tế, đơn giá tổng, chênh lệch, tỉ lệ, số công, chi phí nhân công, ghi chú — ô trống = tự tính, có số = dùng số tay (số sau kéo theo số trước nếu số trước trống). Cột DB `*_override` nullable.
- Bản in chỉ gồm 2 bảng định giá + ghi chú + ký tên (không in phụ lục lệnh/phiếu).
- Số đợt + tên đợt do người dùng tự điền; nút Gợi ý gọi `next-so` (max `dot_so` + 1 theo tháng + máy) khi cần.
- Công thức báo cáo: TL thực tế = chính − thu hồi − hao hụt (override tay được); đơn giá phụ = tiền phụ / TL thực tế; BQ = đơn giá tổng + đơn giá nhân công.
