# nhan_su

| **Bảng** | `nhan_su` |
| **Tab** | `hr` → `/nhan-su` |
| **SQL** | `supabase-nhan-su.sql`, `supabase-nhan-su-dang-nhap.sql`, `supabase-nhan-su-vi-tri.sql`, `supabase-nhan-su-vi-tri-gan.sql`, `supabase-nhan-su-quyen-xem.sql`, `supabase-nhan-su-soft-delete.sql` |

**API:** `server.ts` — `/api/nhan-su`, `POST /api/nhan-su/sync-vi-tri`, `POST /api/nhan-su/bulk-delete`, `POST /api/nhan-su/bulk-restore`, `POST /api/nhan-su/:code/restore`, `PATCH /api/nhan-su/:code/vi-tri-gan`  
**UI:** `src/features/nhan-su/index.tsx` — `HumanResourcesPanel`, `AddStaffModal`  
**Gán vị trí (Cài đặt):** `src/features/cai-dat-thoi-gian/StaffRoleAssignmentPanel.tsx`  
**Utils:** `src/utils/shiftSettings.ts` — ca làm việc; `src/utils/staffExcel.ts` — mẫu/xuất/nhập Excel

### Excel

- **Tải mẫu Excel** / **Xuất Excel** / **Tải Excel lên** trên toolbar `/nhan-su`
- Cột: Mã nhân sự, Họ tên, Chi nhánh, Phòng ban, Chức vụ, Ca làm, Trạng thái, Tên đăng nhập, Mật khẩu
- Nhập: upsert theo `ma_nhan_su` (thiếu mã → tự sinh `NVxxx`); mật khẩu trống khi cập nhật thì giữ mật khẩu cũ

### Xóa hàng loạt (xóa mềm)

- Checkbox từng dòng + chọn đang xem / **Chọn hết** / **Xóa đã chọn** (xóa mềm)
- Khi tick đủ toàn bộ mã → confirm 2 lần trước khi xóa hết
- API: `POST /api/nhan-su/bulk-delete` body `{ codes: string[] }` (xóa mềm; thêm `hard: true` để xóa vĩnh viễn)

### Xóa mềm (soft delete)

- Migration: chạy `supabase-nhan-su-soft-delete.sql` (thêm cột `deleted_at`, `deleted_by`).
- `DELETE /api/nhan-su/:code` và `POST /api/nhan-su/bulk-delete` chỉ gán `deleted_at` (ẩn khỏi danh sách),
  không `DELETE` vật lý. Thêm `?hard=1` / `{ hard: true }` để xóa vĩnh viễn.
- Mọi API đọc (`format=groups`, list, `by-code`) mặc định ẩn bản ghi đã xóa;
  thêm `?includeDeleted=1` để lấy cả bản ghi đã xóa.
- Khôi phục: `POST /api/nhan-su/:code/restore`, `POST /api/nhan-su/bulk-restore` body `{ codes }`.
- UI `/nhan-su`: nút **Hiện đã xóa (n)** để xem dòng đã xóa (mờ + nhãn "Đã xóa"),
  nút **Khôi phục** từng dòng / hàng loạt. Sửa (PUT) hoặc thêm trùng mã + trùng tên
  sẽ tự khôi phục bản ghi đã xóa.

Dùng trong: `ShiftInfoForm`, bảng điều khiển, phân quyền (Vị trí = `cong_viec` / cột `vi_tri`).

### Cột vị trí (`vi_tri`)

- Nút **Cập nhật vị trí** trên toolbar → `POST /api/nhan-su/sync-vi-tri` ghi `vi_tri = {phong_ban}_{chuc_vu}` với mọi dấu cách → `_`.
- Khi thêm/sửa nhân sự: payload gửi `vi_tri` theo cùng rule.

### Cột gán nhiều vị trí (`vi_tri_gan` jsonb)

- Tab **Gán quyền nhân sự** tại `/cai-dat` → `PATCH /api/nhan-su/:ma_nhan_su/vi-tri-gan`
- Giá trị: `[{ department, position, permissionKey }]`
- Khóa theo **`ma_nhan_su`** (tên chỉ hiển thị)
- Chạy `supabase-nhan-su-vi-tri-gan.sql` nếu chưa có cột
