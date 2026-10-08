# theo_doi_cat_le

| | |
|---|---|
| **Nguồn** | `lenh_cat_le` (mã mới + `ngay_cat`), tồn từ `phieu_nhap_kho` + `phieu_xuat_kho` |
| **Tab** | `theo-doi-cat-le` → `/theo-doi-cat-le` (card **Theo dõi cắt lẻ** trong menu **Cắt lẻ** `/cat-le`, menu Kho `/nha-may/kho`) |
| **API** | `GET /api/theo-doi-cat-le?from&to&nhom` (`nhom`: dac/song/rong/khac/all) |

## Vai trò

Bóc miếng nguồn/cắt 1/cắt 2 từ JSON `lenh_cat_le.san_pham`, gộp theo mã AMIS cũ
(không có mã cũ thì dùng mã nguồn). Mã hàng hiển thị là mã AMIS.
Tồn tính từ phiếu trùng mã + tên (`theoDoiCatLeSlipMatches`): phiếu trước `from`
dồn vào tồn đầu, trong kỳ cộng nhập/trừ xuất. UI chỉ hiện 2 cột: Mã hàng, Tồn cuối.
Lọc Sản phẩm VTHH (Đặc/Sóng/Rỗng/Khác) + nút Export Excel (bố cục theo sheet TONGHOP NXT).

## File

- UI: `src/features/theo-doi-cat-le/index.tsx`
- Export: `src/features/_shared/catLeExcel.ts` (`exportTheoDoiCatLe`)
