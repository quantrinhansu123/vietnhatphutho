# phieu_nhap_xuat_tong_hop

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` |
| **Tab** | Form `phieu-nhap-xuat-tong-hop` → `/phieu-nhap-xuat-tong-hop`. Danh sách `phieu-nhap-xuat-tong-hop-list` → `/danh-sach-phieu-nhap-xuat-tong-hop` |
| **SQL** | `supabase-phieu-nhap-xuat-tong-hop.sql`, `supabase-nhap-kho-ma-may.sql` (`nhap_kho.ma_may`), `supabase-phieu-chi-phi-kem-theo.sql` |

## API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET/POST | `/api/xuat-nhap-tong-hop` | Header + ghi vế `phieu_nhap_kho` / `phieu_xuat_kho`. Vế NVL có kho ghi `id_danh_muc` + `loai_danh_muc = kho_nvl` |
| PUT | `/api/xuat-nhap-tong-hop/:id` | Sửa header, sinh lại vế, snapshot `phieu_xuat_nhap_kho_lich_su` |
| POST | `/api/xuat-nhap-tong-hop/:id/huy` | Phiếu đảo, không xóa vế lẻ |
| GET | `/api/xuat-nhap-tong-hop/ton` | Tồn dòng theo kho hoặc máy |
| GET | `/api/ton-may?ma_may=` | Tồn NVL máy, đối chiếu `so_tron` / `bao_cao_may_nvl_ton` |
| POST | `/api/xuat-nhap-tong-hop/ma-moi` | Thêm mã NVL hoặc dòng `nhap_kho` (nhánh NVL bắt buộc `ten_kho` kho NVL đã có trong quản lý kho, lưu `ten_nvl_sx` + `phan_loai` + `loai_kho` theo unique `ma+ten+ten_sx+kho`; trùng unique trả dòng đang sống thay vì 500) |

## Frontend

`src/features/xuat-nhap-tong-hop/index.tsx` — `TongHopPanel` (form). `list.tsx` — `TongHopListPanel` (in, sửa, hủy). Ca nullable, cảnh báo mềm 3 case NVL-máy. In tách theo kho/máy qua `WarehouseSlipPrintModal`.

## Quy ước

- Phiếu nhập: Nguồn nhập không bắt buộc. Để trống thì không sinh vế xuất nguồn. Dropdown mã chỉ dòng `kho_nvl` của đúng kho nhập (khóa chọn là `id`, mã chỉ là nhãn; cùng mã khác tên sản xuất là các dòng khác nhau). Nếu chọn kho nguồn thì chỉ Kho NVL Chính, Kho NVL Phụ, Kho PC (nhà cung cấp cũng được). Cột Kho nhập chỉ ba kho đó. Tên sản xuất là ô gõ trực tiếp (có gợi ý các tên SX của cùng mã trong kho): chọn gợi ý thì gắn `id`, sửa text khác đi thì bỏ gắn `id` (ô highlight vàng, hover báo sẽ tạo mới) — gõ tìm rồi click ra ngoài mà không khớp thì hoàn lại lựa chọn cũ (`revertOnBlurMismatch`), chỉ Enter/bấm Thêm mới chốt tên mới. Gõ trùng tên đã có trong kho hoặc trùng dòng khác cùng phiên (cùng mã + tên + kho, không phân biệt hoa thường/khoảng trắng) thì tự gắn về `id`/chữ đã có, không tạo trùng. Phân loại NVL (`nvl_chinh` / `nvl_phu`) ghi `phan_loai_nvl` trên vế phiếu và `phan_loai` trên dòng `kho_nvl` mới (hoặc dòng kho nhận đang trống phân loại).
- Phiếu xuất: **Loại xuất** cố định (xuất theo phiếu tỷ lệ trộn, trả nhà cung cấp, phế băm, phế cái, xuất khác). **Xuất từ** là kho lấy hàng: dropdown mã chỉ dòng NVL của đúng kho đó (`ten_kho` trùng, hoặc `ten_kho` trống và `loai_kho` = mã kho) hoặc thành phẩm của kho. Giá trị chọn là `kho_nvl.id`, không gộp theo mã. Vế xuất NVL **không tự tạo/sửa master `kho_nvl`** — chỉ gắn `id_danh_muc` đang sống, tên / tên sản xuất sai kho nguồn thì lỗi 400. ĐVT trên lưới xuất là read-only theo danh mục. Mỗi dòng có **Loại kho** (kho hoặc máy) và **Nhập đến** (tên kho hoặc tên máy). Loại “xuất kho cho máy theo phiếu tỷ lệ trộn” hiện Ca, tick phiếu trộn, khóa loại kho là máy và điền Nhập đến bằng máy của lệnh sản xuất. Lưới còn mã, tên, tên sản xuất, ĐVT, nhóm VTHH, ngày tồn, ca, tồn đầu ca, SL CT, SL thực, quy đổi kg, giá, thành tiền, ảnh số cân. Đích máy chỉ ghi vế xuất. Phiếu cũ vẫn đọc được.
- Header lưu `nguoi_lap`, `nguoi_giao`, `dia_diem`, `ly_do`, `ghi_chu`. Người lập chọn từ nhân sự `trang_thai = Đang làm`. Chạy lại `supabase-phieu-nhap-xuat-tong-hop.sql` nếu thiếu 3 cột mới.
- Ca chỉ lấy mục `loai_cai_dat = Thời gian` trong `/cai-dat`.
- `ten_kho` chỉ là tên kho. Máy ghi cột `may`. Row máy trên `nhap_kho`: `ma_may` có giá trị, `ten_kho=''`.
- Báo cáo kho cũ bỏ dòng `nhap_kho.ma_may` không rỗng.
- Không sửa `phieu_chuyen_kho`.
- Chi phí kèm theo nằm trong `chi_tiet[].chi_phi_kem_theo` (`ten`, `don_gia`, `thanh_tien`, tối đa 50 khoản). `thanh_tien` dòng hàng vẫn là SL × đơn giá. Tổng KL / Tổng hàng / Tổng kèm / Tổng cộng chỉ tính khi hiển thị. Mirror cột `chi_phi_kem_theo` trên `phieu_nhap_kho` và `phieu_xuat_kho`; không đụng `phieu_xuat_nhap_kho`. Chạy `supabase-phieu-chi-phi-kem-theo.sql`.
