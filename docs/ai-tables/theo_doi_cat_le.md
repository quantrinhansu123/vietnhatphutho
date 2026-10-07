# theo_doi_cat_le

| | |
|---|---|
| **Nguồn** | `bao_cao_don_cat_le_san_pham`, `phieu_nhap_kho`, `phieu_xuat_kho` |
| **Tab** | `theo-doi-cat-le` → `/theo-doi-cat-le` (card **Theo dõi cắt lẻ** trong Kho và Sản xuất) |
| **API** | `GET /api/theo-doi-cat-le` |

## Vai trò

Danh sách gộp theo `ma_amis_cu`. Không có mã cũ thì hiện `ma_amis`.
Cột: STT, Mã hàng, ĐVT, Tồn, Nhập, Xuất, Trọng lượng, Thành tiền.
Tồn = Nhập − Xuất. Trọng lượng và thành tiền là phần nhập trừ phần xuất.

Chỉ cộng dòng phiếu khi cùng mã AMIS (`ma_sp` / `ma_npl`), tên sản phẩm và tên sản xuất với một dòng báo cáo. Phiếu thành phẩm chỉ lưu một tên ở `ten_sp`: khớp tên sản phẩm hoặc tên sản xuất.

## File

- UI: `src/features/theo-doi-cat-le/index.tsx`
