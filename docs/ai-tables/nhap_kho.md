# nhap_kho

| | |
|---|---|
| **Bảng** | `nhap_kho` |
| **Tab** | `/kho-hang` → mọi kho (sổ tồn chung SP + NVL, phân biệt `loai_kho` + `ten_kho`); ghi sau phiếu nhập (TP và NVL) |
| **SQL** | `supabase-nhap-kho.sql` + `supabase-nhap-kho-cat-le.sql` (7 cột thông số) + `supabase-nhap-kho-loai-kho.sql` (backfill `loai_kho`) + `supabase-nhap-kho-mo-ta-tem.sql` (`mo_ta_tem`) + `supabase-nhap-kho-ten-san-xuat.sql` (`ten_san_xuat` = tên NVL SX) + `supabase-nhap-kho-backfill-nvl.sql` (catalog NVL từ phiếu cũ) + `supabase-kho-cat-le-seed.sql` (20 SP Kho cắt lẻ, phiếu `PNK-CL-SEED` / `PXK-CL-SEED`) + `supabase-nhap-kho-ma-sp-cu.sql` (`ma_sp_cu`) |

## Vai trò

Sổ **tồn chung mọi loại hàng** (`ma_sp` = mã hàng — NVL thì `ma_sp = ma_npl`; `ten_sp` = tên hàng; `ten_san_xuat` = tên NVL SX, TP để trống), phân biệt kho bằng `loai_kho` (mã kho từ `quan_ly_kho.ma_kho`: TP `kho_thanh_pham` | cắt lẻ `kho_cat_le` | tái chế `kho_tai_che` | NVL `kho_nvl/kho_nvl_chinh/kho_nvl_phu/kho_pc`; mã cũ đọc tương thích).  
**Không** dùng bảng `ton_kho_thanh_pham` cho màn Kho hàng.

- Danh sách SP: gộp theo `ma_sp` + `ten_sp` + `trong_luong_kg_mot_sp|so_m2_mot_sp|so_m_dai_mot_sp`. Cùng mã và tên nhưng khác quy đổi là hai dòng.
- Tồn đầu / Nhập / Xuất / Tồn: tính từ phiếu `phieu_xuat_nhap_kho` (`loai_kho=san_pham`)
- **NVL kho-only (chốt):** phiếu nhập NVL và chuyển kho NVL **không ghi** `nhap_kho` nữa (dòng NVL cũ vẫn nằm đây để tra cứu legacy). Master NVL nằm ở `kho_nvl` (tự ensure theo unique `ma_npl+ten_npl+ten_nvl_sx`), tồn tính từ phiếu qua `GET /api/ton-kho-nvl`.

Cột: `ma_sp`, `ten_sp`, `don_vi`, `trong_luong_kg_mot_sp`, `so_m2_mot_sp`, `so_m_dai_mot_sp` (hệ số **1 SP**), `loai_kho` (không default), `ten_kho`, `ma_may`, `ten_may` (`supabase-nhap-kho-ma-may.sql`: row kho `ma_may` trống, row máy `ma_may` có giá trị và `ten_kho=''`), `mo_ta_tem`, `ma_sp_cu` (mã gốc của biến thể cắt lẻ — `ma_sp` dòng này là mã mới, dùng tổng hợp về sau; migration `supabase-nhap-kho-ma-sp-cu.sql`). Báo cáo kho bỏ dòng có `ma_may`.

SL và tổng kg / m² / mét dài của dòng phiếu nằm ở `phieu_xuat_nhap_kho`. `nhap_kho` không lưu `so_luong`, `trong_luong_kg`, `so_m2`, `so_m_dai`.

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/nhap-kho` | Không `from`/`to`: raw records. Có `from`+`to`: rows tồn kỳ (catalog `nhap_kho` + số liệu phiếu NX). `strictKho=1` + `ten_kho`: chỉ hàng đúng kho (lọc catalog theo `ten_kho` hoặc `loai_kho`, phiếu qua `ten_kho`) — `/kho-hang`, Lệnh cắt, Chuyển kho dùng |
| GET | `/api/ton-kho-thanh-pham` | Alias cũ → cùng `loadNhapKhoThanhPhamPeriodRows` (không đọc/ghi `ton_kho_thanh_pham`) |
| (ghi) | Sau `POST`/`PUT` phiếu nhập TP | `insertNhapKhoThanhPhamRows` — nếu payload có `maLenhSx`, đọc `lenh_sx.ma_don_hang` rồi JSON `don_hang.san_pham` để ghi `ten_goc`, `do_li`, `do_li_dm`, `do_day_m`, `do_dai_m`, `mang`, `hang_phe`, `ma_amis`, `mo_ta_tem` |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-hang/ThanhPhamStockPanel.tsx` | Gọi `/api/nhap-kho?from=&to=` |
| `src/features/kho-hang/index.tsx` | Một màn TP |
| `src/features/phieu-xuat-nhap-kho/thanhPham.ts` | `aggregateNhapKhoProducts`, `mergeNhapKhoCatalogWithPeriodBalances` |
