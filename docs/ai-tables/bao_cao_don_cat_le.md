# bao_cao_don_cat_le

| | |
|---|---|
| **Bảng** | `bao_cao_don_cat_le` (CRUD cũ giữ nguyên, UI mới không dùng) |
| **Tab** | `bao-cao-don-cat-le` → `/bao-cao-don-cat-le` (card **Báo cáo đơn cắt lẻ** trong menu **Cắt lẻ** `/cat-le`, menu Kho `/nha-may/kho`) |
| **SQL** | `supabase-bao-cao-don-cat-le.sql` |
| **API mới** | `GET /api/bao-cao-cat-le-tong-hop?from&to&nhom` |

## Vai trò (mới, kiểu Tổng hợp tồn kho phần mềm)

Hàng = mã AMIS cũ gộp các mã AMIS có trong sổ `nhap_kho`
(`ma_sp_cu` → cũ, `ma_sp`/`ma_amis` → mới).
Số liệu cộng từ `phieu_nhap_kho` / `phieu_xuat_kho` theo kỳ:
SL = `so_luong`, SL theo ĐVC = `so_m2`, Giá trị = `thanh_tien`.
Tên hàng = Tên sản phẩm (`san_pham.ten_sp` dòng gốc, theo mã cũ) — không dùng tên sản xuất;
UI hiện đủ chữ (wrap, không truncate), export giữ nguyên tên đầy đủ.
Cột: Mã hàng, Tên hàng, ĐVT, ĐVC + Đầu kỳ/Nhập/Xuất/Cuối kỳ (SL, SL theo ĐVC, Giá trị) + dòng Tổng cộng.
Lọc VTHH + nút Export Excel (bố cục 2 tầng header như file Tổng hợp tồn kho).

## File

- UI: `src/features/bao-cao-don-cat-le/index.tsx`
- Export: `src/features/_shared/catLeExcel.ts` (`exportBaoCaoCatLe`)
- CRUD cũ: `GET/POST/PUT/DELETE /api/bao-cao-don-cat-le` (giữ, không dùng ở UI mới)
