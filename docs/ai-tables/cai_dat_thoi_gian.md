# cai_dat_thoi_gian

| **Bảng** | `cai_dat_thoi_gian` |
| **Tab** | `settings` → `/cai-dat` |
| **SQL** | `supabase-cai-dat-thoi-gian.sql` |

**API:** `server.ts` — `/api/cai-dat` (xem `registry.ts` / grep route)  
**UI:** `src/features/cai-dat-thoi-gian/index.tsx` — `SettingsPanel` (hệ thống / phân quyền / phân quyền vai trò)  
**Utils:** `src/utils/shiftSettings.ts`, `permissionKeys.ts`, `RolePermissionsMatrix.tsx`, `src/features/nhan-su/menuViews.ts`

Cấu hình ca, khung giờ — ảnh hưởng phiếu cân và báo cáo.

Tab **Phân quyền các Vai trò**: ma trận menu × (Xem / Sửa / Xóa). Tick menu cha chọn hết menu con. Lưu trong `cai_dat_thoi_gian.note` JSON (`viewPermissions`, `editPermissions`, `deletePermissions`) theo key Phòng ban + Vị trí.
