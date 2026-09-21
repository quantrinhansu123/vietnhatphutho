# chi_phi_dien

| **Bảng** | `chi_phi_dien` |
| **Tab** | `chi-phi-dien` → `/chi-phi-dien` (card **Chi phí điện** trong `/hcns`) |
| **SQL** | `supabase-chi-phi-dien.sql` |

**API:** `server.ts` — `parseChiPhiDienBody + GET/POST/PUT/DELETE /api/chi-phi-dien` (sau chi-phi-nhan-cong, lọc `?nam&loai_may`; `thang = 0` = cả năm)
**UI:** `src/features/chi-phi-dien/index.tsx` — `ChiPhiDienPanel`, `ChiPhiDienList`, `ChiPhiDienForm`, `YearPickerVi`, `ChiPhiDienSheet`
**Utils:** `src/features/chi-phi-dien/aggregate.ts` (gom SP theo loại, Đồng/Kg, mốc so sánh năm)

### Nghiệp vụ

- **Màn hình:** Mở từ menu `/hcns` → thẻ **Chi phí điện**. Định giá theo **năm**, không dùng tháng (`thang = 0`, `chi_tiet.ky = 'nam'`; các bản ghi cũ tính theo tháng vẫn nằm trong DB nhưng UI chỉ hiện bản ghi năm).
- **Chọn kỳ + loại máy:** Chọn Năm (`YearPickerVi` popup tiếng Việt) + chọn nhiều Loại/Nhóm máy (lấy từ `danh_sach_may.loai_may/nhom_may`).
- **Thành phẩm tự động:** gộp sổ trộn cả năm = 12 request `GET /api/so-tron?tu_ngay=YYYY-MM-01&den_ngay=YYYY-MM-cuối&limit=1000` song song (mỗi request tối đa 1000 phiếu), khử trùng lặp theo `id` → mỗi phiếu chỉ lưu theo máy (`ma_may`/`ten_may`) nên map máy → Loại/Nhóm qua `danh_sach_may` rồi cộng dồn `bang_san_pham.trong_luong` (fallback `tong_sp_co_mang + tong_sp_khong_mang`).
- **Nhập tay:** Tiền điện (đ) + ghi chú diễn giải từng loại máy; `Đồng/Kg = Tiền điện / Thành phẩm` (làm tròn đồng), dòng `TB/SL` = tổng tiền / tổng SP.
- **So sánh năm trước:** tự lấy bản ghi năm gần nhất (`pickYearComparison`, chỉ xét bản ghi năm), hiện dòng đỏ `- SP <loại> chi phí điện là Xđ/kg tăng/giảm Yđ so với năm YYYY (<ghi chú>)`. Không có số liệu thì bỏ đoạn so sánh.
- **Thêm / Sửa / Xem:** bảng kiểu phiếu `CHI PHÍ TIỀN ĐIỆN` (header xanh lá) dùng chung cho form preview và màn xem.
