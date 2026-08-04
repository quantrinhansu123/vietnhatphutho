# nhan_su

| **Bảng** | `nhan_su` |
| **Tab** | `hr` → `/nhan-su` |
| **SQL** | `supabase-nhan-su.sql`, `supabase-nhan-su-dang-nhap.sql`, `supabase-nhan-su-vi-tri.sql` |

**API:** `server.ts` — `/api/nhan-su`, `POST /api/nhan-su/sync-vi-tri`  
**UI:** `src/features/nhan-su/index.tsx` — `HumanResourcesPanel`, `AddStaffModal`  
**Utils:** `src/utils/shiftSettings.ts` — ca làm việc

Dùng trong: `ShiftInfoForm`, bảng điều khiển, phân quyền (Vị trí = `cong_viec` / cột `vi_tri`).

### Cột vị trí (`vi_tri`)

- Nút **Cập nhật vị trí** trên toolbar → `POST /api/nhan-su/sync-vi-tri` ghi `vi_tri = {phong_ban}_{chuc_vu}` với mọi dấu cách → `_` (ví dụ: `Phòng_Kinh_Doanh_Giám_đốc_kinh_doanh`).
- Khi thêm/sửa nhân sự: payload gửi `vi_tri` theo cùng rule.
- Chạy `supabase-nhan-su-vi-tri.sql` nếu bảng chưa có cột `vi_tri`.
