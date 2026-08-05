# cai_dat_thoi_gian

| **Bảng** | `cai_dat_thoi_gian` |
| **Tab** | `settings` → `/cai-dat` |
| **SQL** | `supabase-cai-dat-thoi-gian.sql` |

**API:** `server.ts` — `/api/cai-dat` (xem `registry.ts` / grep route)  
**UI:** `src/features/cai-dat-thoi-gian/index.tsx` — `SettingsPanel`  
**Utils:** `src/utils/shiftSettings.ts`, `permissionKeys.ts`, `staffAssignments.ts`, `RolePermissionsMatrix.tsx`, `StaffRoleAssignmentPanel.tsx`, `src/features/nhan-su/menuViews.ts`

Cấu hình ca, khung giờ — ảnh hưởng phiếu cân và báo cáo.

## Quyền giao diện

Đăng nhập lấy quyền menu từ ma trận **Phân quyền**:

1. Ưu tiên các vị trí trong `nhan_su.vi_tri_gan` (tab Gán quyền nhân sự) → gộp (union) Xem/Sửa/Xóa
2. Không có gán → theo phòng ban + chức vụ HR
3. Không khớp PERM_KEY → chỉ dùng `quyen_xem` hồ sơ (nếu có)

Admin / tài khoản quản trị vẫn full menu.

| Cột ma trận | Hiệu lực UI |
|-------------|-------------|
| **Xem** | Hiện mục menu / vào tab (`App.tsx`, drawer) |
| **Sửa** | Hiện nút Thêm + Sửa (`useTabAccess` → `canCreate`/`canEdit`) |
| **Xóa** | Hiện nút Xóa (`canDelete`) |

Helper: `src/app/useTabAccess.ts` · context: `src/app/accessControl.tsx`.

## Các tab

| Tab | Lưu DB | Chi tiết |
|-----|--------|----------|
| Cài đặt hệ thống | `cai_dat_thoi_gian` | Thời gian / Ca máy / … |
| Phân quyền + Vai trò | `cai_dat_thoi_gian` · `PERM_KEY_…` | JSON: department, position, view/edit/delete |
| **Gán quyền nhân sự** | **`nhan_su.vi_tri_gan`** theo `ma_nhan_su` | Không ghi STAFF_ASSIGN vào cai_dat |

Xem thêm: [nhan_su.md](./nhan_su.md)
