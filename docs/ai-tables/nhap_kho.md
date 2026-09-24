# nhap_kho

| | |
|---|---|
| **Bảng** | `nhap_kho` |
| **Tab** | `/kho-hang` → Kho thành phẩm; ghi sau phiếu nhập TP |
| **SQL** | `supabase-nhap-kho.sql` + `supabase-nhap-kho-cat-le.sql` (7 cột thông số) + `supabase-nhap-kho-loai-kho.sql` (backfill `loai_kho`) + `supabase-nhap-kho-mo-ta-tem.sql` (`mo_ta_tem`) + `supabase-kho-cat-le-seed.sql` (20 SP Kho cắt lẻ, phiếu `PNK-CL-SEED` / `PXK-CL-SEED`) |

## Vai trò

Sổ **danh sách sản phẩm** các kho thành phẩm (`loai_kho` = mã kho từ `quan_ly_kho.ma_kho`:
TP `kho_thanh_pham` | cắt lẻ `kho_cat_le` | tái chế `kho_tai_che`; mã cũ `thanh_pham/cat_le/tai_che` đọc tương thích).  
**Không** dùng bảng `ton_kho_thanh_pham` cho màn Kho hàng.

- Danh sách SP: gộp theo `ma_sp` + `ten_sp` + `trong_luong_kg_mot_sp|so_m2_mot_sp|so_m_dai_mot_sp`. Cùng mã và tên nhưng khác quy đổi là hai dòng.
- Tồn đầu / Nhập / Xuất / Tồn: tính từ phiếu `phieu_xuat_nhap_kho` (`loai_kho=san_pham`)

Cột: `ma_sp`, `ten_sp`, `don_vi`, `trong_luong_kg_mot_sp`, `so_m2_mot_sp`, `so_m_dai_mot_sp` (hệ số **1 SP**), `loai_kho` (không default), `ten_kho`, `mo_ta_tem` (mô tả tem đơn miền nam, migration `supabase-nhap-kho-mo-ta-tem.sql`).

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
