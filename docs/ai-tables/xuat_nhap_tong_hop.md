# phieu_nhap_xuat_tong_hop

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` |
| **Tab** | Form `phieu-nhap-xuat-tong-hop` → `/phieu-nhap-xuat-tong-hop`. Danh sách `phieu-nhap-xuat-tong-hop-list` → `/danh-sach-phieu-nhap-xuat-tong-hop` |
| **SQL** | `supabase-phieu-nhap-xuat-tong-hop.sql`, `supabase-nhap-kho-ma-may.sql` (`nhap_kho.ma_may`) |

## API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET/POST | `/api/xuat-nhap-tong-hop` | Header + ghi vế `phieu_nhap_kho` / `phieu_xuat_kho`. Vế NVL có kho ghi `id_danh_muc` + `loai_danh_muc = kho_nvl` |
| PUT | `/api/xuat-nhap-tong-hop/:id` | Sửa header, sinh lại vế, snapshot `phieu_xuat_nhap_kho_lich_su` |
| POST | `/api/xuat-nhap-tong-hop/:id/huy` | Phiếu đảo, không xóa vế lẻ |
| GET | `/api/xuat-nhap-tong-hop/ton` | Tồn dòng theo kho hoặc máy |
| GET | `/api/ton-may?ma_may=` | Tồn NVL máy, đối chiếu `so_tron` / `bao_cao_may_nvl_ton` |
| POST | `/api/xuat-nhap-tong-hop/ma-moi` | Thêm mã NVL hoặc dòng `nhap_kho` (nhánh NVL giữ `ten_kho`/`loai_kho` khi có để không sinh master trống kho hiện thành "Kho NVL" 0/0/0) |

## Frontend

`src/features/xuat-nhap-tong-hop/index.tsx` — `TongHopPanel` (form). `list.tsx` — `TongHopListPanel` (in, sửa, hủy). Ca nullable, cảnh báo mềm 3 case NVL-máy. In tách theo kho/máy qua `WarehouseSlipPrintModal`.

## Quy ước

- Phiếu nhập: Nguồn nhập không bắt buộc. Để trống thì danh mục mã là toàn bộ `kho_nvl`, không sinh vế xuất nguồn. Nếu chọn kho nguồn thì chỉ Kho NVL Chính, Kho NVL Phụ, Kho PC (nhà cung cấp cũng được). Cột Kho nhập chỉ ba kho đó. Tên sản xuất là dropdown tìm và chọn lại. Khi lưu, kiểm tra unique `mã + tên + tên sản xuất + kho nhập`: đã có thì chỉ ghi phiếu nhập; chưa có thì thêm dòng `kho_nvl` của kho đó. Phân loại NVL (`nvl_chinh` / `nvl_phu`) ghi `phan_loai_nvl` trên vế phiếu và `phan_loai` trên dòng `kho_nvl` mới (hoặc dòng kho nhận đang trống phân loại).
- Phiếu xuất: **Loại xuất** cố định (xuất theo phiếu tỷ lệ trộn, trả nhà cung cấp, phế băm, phế cái, xuất khác). **Xuất từ** là kho lấy hàng: dropdown mã chỉ load NVL hoặc thành phẩm có `ten_kho` trùng kho đó (`GET /api/kho-nvl?ten_kho=` hoặc danh mục `nhap_kho` của kho). Mỗi dòng có **Loại kho** (kho hoặc máy) và **Nhập đến** (tên kho hoặc tên máy). Loại “xuất kho cho máy theo phiếu tỷ lệ trộn” hiện Ca, tick phiếu trộn, khóa loại kho là máy và điền Nhập đến bằng máy của lệnh sản xuất. Lưới còn mã, tên, tên sản xuất, ĐVT, nhóm VTHH, ngày tồn, ca, tồn đầu ca, SL CT, SL thực, quy đổi kg, giá, thành tiền, ảnh số cân. Đích máy chỉ ghi vế xuất. Phiếu cũ vẫn đọc được.
- Header lưu `nguoi_lap`, `nguoi_giao`, `dia_diem`, `ly_do`, `ghi_chu`. Người lập chọn từ nhân sự `trang_thai = Đang làm`. Chạy lại `supabase-phieu-nhap-xuat-tong-hop.sql` nếu thiếu 3 cột mới.
- Ca chỉ lấy mục `loai_cai_dat = Thời gian` trong `/cai-dat`.
- `ten_kho` chỉ là tên kho. Máy ghi cột `may`. Row máy trên `nhap_kho`: `ma_may` có giá trị, `ten_kho=''`.
- Báo cáo kho cũ bỏ dòng `nhap_kho.ma_may` không rỗng.
- Không sửa `phieu_chuyen_kho`.
