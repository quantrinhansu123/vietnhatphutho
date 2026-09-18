# chi_phi_nhan_cong

| **Bảng** | `chi_phi_nhan_cong` |
| **Tab** | `chi-phi-nhan-cong` → `/chi-phi-nhan-cong` |
| **SQL** | `supabase-chi-phi-nhan-cong.sql` |

**API:** `server.ts` — `GET/POST /api/chi-phi-nhan-cong`, `GET/PUT/DELETE /api/chi-phi-nhan-cong/:id`  
**UI:** `src/features/chi-phi-nhan-cong/index.tsx` — `ChiPhiNhanCongPanel`, `ChiPhiNhanCongList`, `ChiPhiNhanCongForm`, `MonthYearPickerVi`  
**Utils:** `src/features/chi-phi-nhan-cong/calculateLabor.ts` — Bóc tách giờ làm & điều động giữa các máy

### Nghiệp vụ

- **Màn hình:** Mở từ menu `/hcns` → thẻ **Chi phí nhân công**.
- **Danh sách:** Tìm kiếm và lọc theo tháng, năm, máy, người lập.
- **Thêm mới / Sửa chữa:**
  - Chọn Tháng & Năm (theo chuẩn tiếng Việt).
  - Chọn máy (**hỗ trợ chọn nhiều máy cùng lúc**).
  - Tự động lấy dữ liệu từ `phan_cong_nhan_su_chi_tiet` (lịch làm việc) và `dieu_dong_nhan_su` (phát sinh điều động thực tế trong tháng).
  - Bóc tách điều động: trừ giờ máy gốc khi đi, cộng giờ vào máy đến, cộng dồn khi làm thêm/tăng ca tại máy.
  - Bảng chi tiết nhân công theo từng máy.
  - **Bảng ở cuối:**
    - Ma trận tổng hợp theo ngày trong tháng cho tất cả các máy được chọn.
    - Tổng hợp theo từng nhân sự qua toàn bộ các máy được chọn (tổng giờ, số công chuẩn giờ/8, thành tiền).
    - Thẻ tổng kết tháng: tổng nhân sự, tổng giờ làm việc, tổng số công, tổng chi phí.
