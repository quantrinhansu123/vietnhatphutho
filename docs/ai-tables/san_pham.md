# san_pham

| | |
|---|---|
| **Bảng** | `san_pham` |
| **Tab** | `products` → `/san-pham` |
| **SQL** | `supabase-san-pham.sql`, `supabase-san-pham-dinh-muc.sql`, `supabase-san-pham-npl-phan-tram.sql`, `supabase-san-pham-ton-dau-ky.sql`, `supabase-san-pham-kiem-kho-dong-bo.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/san-pham` | 3507 |
| POST | `/api/san-pham` | 3564 |
| PATCH | `/api/san-pham/:id` | 3629 |
| DELETE | `/api/san-pham` | 3592 |
| POST | `/api/kiem-kho/dong-bo-ton-dau` | Đồng bộ phiếu kiểm kho vào `ton_dau_ky` |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/san-pham/index.tsx` | Panel / logic chính |
| `src/features/san-pham/types.ts` | Panel / logic chính |
| `src/features/san-pham/productFieldClass.ts` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Cột quan trọng

`ma_sp`, `ten_sp`, `nhom_vthh`, `ton_dau_ky`, `dinh_muc_npl` (JSON NPL).

Đồng bộ kiểm kho dùng `supabase-san-pham-kiem-kho-dong-bo.sql` trên DB chính để bảo đảm mỗi `kiem_kho.id` chỉ cộng một lần.

## Không đọc

Các file feature ở trên — không mở `App.monolith.backup.tsx` trừ khi cần tham chiếu lịch sử.
