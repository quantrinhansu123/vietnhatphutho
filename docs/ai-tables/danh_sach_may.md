# danh_sach_may

| **Bảng** | `danh_sach_may` |
| **Tab** | `machines` → `/danh-sach-may` |
| **SQL** | `supabase-danh-sach-may.sql` |

**API:** `server.ts` — `/api/danh-sach-may`
**UI:** `src/features/danh-sach-may/index.tsx` — `MachinesPanel` (nút Xem → modal định mức tỉ lệ trộn)

**Cột quan trọng:** `ma_may`, `ten_may`, `dinh_luong`, `ty_le_tron` (JSONB: `[{ma_nvl, ten_nvl, phan_tram}]`).
