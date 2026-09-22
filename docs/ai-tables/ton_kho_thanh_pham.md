# ton_kho_thanh_pham

| | |
|---|---|
| **Bảng** | `ton_kho_thanh_pham` — **không dùng** cho màn `/kho-hang` |
| **Thay bằng** | [`nhap_kho.md`](./nhap_kho.md) — danh sách SP + tồn kỳ |

Màn Kho thành phẩm lấy danh sách từ `nhap_kho` (`loai_kho=thanh_pham`), tính tồn từ phiếu NX.  
API chính: `GET /api/nhap-kho?from=&to=`. Alias cũ `/api/ton-kho-thanh-pham` cũng trỏ cùng nguồn (không đọc/ghi bảng này).
