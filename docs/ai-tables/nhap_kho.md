# nhap_kho

| | |
|---|---|
| **Bảng** | `nhap_kho` |
| **Tab** | `/kho-hang` → Kho thành phẩm; ghi sau phiếu nhập TP |
| **SQL** | `supabase-nhap-kho.sql` |

## Vai trò

Sổ **danh sách sản phẩm** kho thành phẩm (`loai_kho = 'thanh_pham'`).  
**Không** dùng bảng `ton_kho_thanh_pham` cho màn Kho hàng.

- Danh sách SP: gộp theo `ma_sp` + `ten_sp` từ `nhap_kho`
- Tồn đầu / Nhập / Xuất / Tồn: tính từ phiếu `phieu_xuat_nhap_kho` (`loai_kho=san_pham`)

Cột: `ma_sp`, `ten_sp`, `don_vi`, `so_luong`, `trong_luong_kg`, `so_m2`, `so_m_dai`, `loai_kho` (không default), `ten_kho`.

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/nhap-kho` | Không `from`/`to`: raw records. Có `from`+`to`: rows tồn kỳ (catalog `nhap_kho` + số liệu phiếu NX) |
| GET | `/api/ton-kho-thanh-pham` | Alias cũ → cùng `loadNhapKhoThanhPhamPeriodRows` (không đọc/ghi `ton_kho_thanh_pham`) |
| (ghi) | Sau `POST`/`PUT` phiếu nhập TP | `insertNhapKhoThanhPhamRows` |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/kho-hang/ThanhPhamStockPanel.tsx` | Gọi `/api/nhap-kho?from=&to=` |
| `src/features/kho-hang/index.tsx` | Một màn TP |
| `src/features/phieu-xuat-nhap-kho/thanhPham.ts` | `aggregateNhapKhoProducts`, `mergeNhapKhoCatalogWithPeriodBalances` |
