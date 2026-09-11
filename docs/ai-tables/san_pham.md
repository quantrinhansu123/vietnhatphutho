# san_pham

| | |
|---|---|
| **Bảng** | `san_pham` |
| **Tab** | `products` → `/san-pham` |
| SQL | `supabase-san-pham.sql`, `supabase-san-pham-ma-amis-khong-unique.sql`, `supabase-san-pham-dinh-muc.sql`, `supabase-san-pham-npl-phan-tram.sql`, `supabase-san-pham-nhom-vthh-kinh-doanh.sql`, `supabase-san-pham-nhom-vthh-them-khac.sql`, `supabase-san-pham-ton-dau-ky.sql`, `supabase-san-pham-kiem-kho-dong-bo.sql`, `supabase-san-pham-thong-so-sx.sql` |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET | `/api/san-pham` | 3507 |
| POST | `/api/san-pham` | 3564 |
| POST | `/api/san-pham/import-batch` | batch insert `creates` + upsert `updates` (chunk phía client ~150) |
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

`ma_sp`, `ten_sp`, `ten_san_xuat`, `don_vi` (`m`, `m2`, `Tấm`), `nhom_vthh`, `ton_dau_ky`, `npl_phan_tram` (JSON NPL, mỗi dòng lưu thêm `ten_nvl_sx` tương ứng từ Kho NVL).

Thông số SX (migration `supabase-san-pham-thong-so-sx.sql`): `ten_goc`, `do_li`, `do_li_dm` (extract `(đm n li)` từ `ten_san_xuat`), `do_day_m`, `do_dai_m`, `mang`, `hang_phe`.  
**`do_li`**: ưu tiên li tường minh trong tên SX trước ZEM (ZEM lẫn trong tên gốc như `…TRẮNG 8ZEM…` không phải độ li); độ li chứa KG thì bỏ.  
**`ten_ghep`** (migration `supabase-san-pham-ten-ghep.sql`, có backfill): tên ghép hiển thị, app tự tính + lưu mỗi khi thêm/sửa/import.
**`hang_phe` chỉ khi `ten_san_xuat` ghi rõ** (`hàng 100% NS Off` / `hàng chạy 100% phế` / `hàng 100% phế` / `chạy 100% phế` / `hàng nguyên phế` / `hàng tiêu chuẩn` / `100%NS` giữ nguyên text); không suy diễn từ mã AMIS hay token `NP`. Form chỉ tự đổi Hàng phế khi tên có marker, còn lại giữ giá trị đang có. Sửa dữ liệu cũ: `supabase-san-pham-fix-hang-phe.sql`; cập nhật riêng hàng nguyên phế: `supabase-san-pham-cap-nhat-hang-nguyen-phe.sql`.
**Import Excel** (`productCatalogExcel.ts`): Độ li ghi tay chứa KG thì bỏ, dùng suy từ tên SX; ĐVT `CUỘN, TẤM` chuẩn hóa về `Tấm`; luôn tính `ten_ghep` từ tên SX (+ cột ghi tay) và lưu DB.
**Unique không đổi:** API vẫn chặn trùng bộ `ma_amis + ten_sp + ten_san_xuat`. Không tạo unique mới trên các cột thông số.

Utils ghép tên: `src/utils/productProductionName.ts` (Đặc/Rỗng/Sóng; Sóng seed `do_dai_m` = m dài nhất cùng AMIS).

Đồng bộ kiểm kho dùng `supabase-san-pham-kiem-kho-dong-bo.sql` trên DB chính để bảo đảm mỗi `kiem_kho.id` chỉ cộng một lần.

Danh sách chỉ hiển thị `Thành phẩm`; mỗi sản phẩm là nhóm dòng, các đơn vị quy đổi hợp lệ (`m`, `m2`, `Tấm`, `kg`) nằm ở dòng con. Plan/mockup: `plan_danh_sach_san_pham.md`.

### Excel danh mục SP

- Nút **Tải mẫu Excel** / **Tải Excel lên** (và **Tải mẫu Excel SP**) — `src/utils/productCatalogExcel.ts`
- Cột khớp bảng UI trước: Mã SP, Tên, Tính chất, Nhóm, Đơn vị, Tổng TL, Tồn đầu, Nhập, Xuất, Tồn, Tồn TT + thêm định mức (AMIS, khổ cuộn, TL lõi/túi/nhựa…)
- **Ô trống vẫn đẩy lên** (chỉ bắt buộc có Mã SP hoặc Tên)
- Upsert theo `ma_sp` — API chặn trùng bộ `ma_amis + ten_sp + ten_san_xuat` bằng truy vấn tồn tại trực tiếp trong DB
- Nếu DB còn unique `ma_amis`: chạy `supabase-san-pham-ma-amis-khong-unique.sql`
- File mẫu cũ kiểu Tên NVL/Loại/Giá trị → báo lỗi hướng dẫn dùng mẫu danh mục
- Định mức NVL riêng: **Mẫu định mức NVL** / **Nhập định mức NVL**

## Không đọc

Các file feature ở trên — không mở `App.monolith.backup.tsx` trừ khi cần tham chiếu lịch sử.
