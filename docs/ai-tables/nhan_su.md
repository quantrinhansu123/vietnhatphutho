# nhan_su

| **Bảng** | `nhan_su` |
| **Tab** | `hr` → `/nhan-su` |
| **SQL** | `supabase-nhan-su.sql`, `supabase-nhan-su-dang-nhap.sql`, `supabase-nhan-su-vi-tri.sql`, `supabase-nhan-su-vi-tri-gan.sql`, `supabase-nhan-su-quyen-xem.sql` |

**API:** `server.ts` — `/api/nhan-su`, `POST /api/nhan-su/sync-vi-tri`, `PATCH /api/nhan-su/:code/vi-tri-gan`  
**UI:** `src/features/nhan-su/index.tsx` — `HumanResourcesPanel`, `AddStaffModal`  
**Gán vị trí (Cài đặt):** `src/features/cai-dat-thoi-gian/StaffRoleAssignmentPanel.tsx`  
**Utils:** `src/utils/shiftSettings.ts` — ca làm việc

Dùng trong: `ShiftInfoForm`, bảng điều khiển, phân quyền (Vị trí = `cong_viec` / cột `vi_tri`).

### Cột vị trí (`vi_tri`)

- Nút **Cập nhật vị trí** trên toolbar → `POST /api/nhan-su/sync-vi-tri` ghi `vi_tri = {phong_ban}_{chuc_vu}` với mọi dấu cách → `_`.
- Khi thêm/sửa nhân sự: payload gửi `vi_tri` theo cùng rule.

### Cột gán nhiều vị trí (`vi_tri_gan` jsonb)

- Tab **Gán quyền nhân sự** tại `/cai-dat` → `PATCH /api/nhan-su/:ma_nhan_su/vi-tri-gan`
- Giá trị: `[{ department, position, permissionKey }]`
- Khóa theo **`ma_nhan_su`** (tên chỉ hiển thị)
- Chạy `supabase-nhan-su-vi-tri-gan.sql` nếu chưa có cột
