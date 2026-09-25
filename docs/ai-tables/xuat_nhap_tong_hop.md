# phieu_nhap_xuat_tong_hop

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` |
| **Tab** | Form `phieu-nhap-xuat-tong-hop` → `/phieu-nhap-xuat-tong-hop`. Danh sách `phieu-nhap-xuat-tong-hop-list` → `/danh-sach-phieu-nhap-xuat-tong-hop` |
| **SQL** | `supabase-phieu-nhap-xuat-tong-hop.sql`, `supabase-nhap-kho-ma-may.sql` (`nhap_kho.ma_may`) |

## API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET/POST | `/api/xuat-nhap-tong-hop` | Header + ghi vế `phieu_nhap_kho` / `phieu_xuat_kho` |
| PUT | `/api/xuat-nhap-tong-hop/:id` | Sửa header, sinh lại vế, snapshot `phieu_xuat_nhap_kho_lich_su` |
| POST | `/api/xuat-nhap-tong-hop/:id/huy` | Phiếu đảo, không xóa vế lẻ |
| GET | `/api/xuat-nhap-tong-hop/ton` | Tồn dòng theo kho hoặc máy |
| GET | `/api/ton-may?ma_may=` | Tồn NVL máy, đối chiếu `so_tron` / `bao_cao_may_nvl_ton` |
| POST | `/api/xuat-nhap-tong-hop/ma-moi` | Thêm mã NVL hoặc dòng `nhap_kho` |

## Frontend

`src/features/xuat-nhap-tong-hop/index.tsx` — `TongHopPanel` (form). `list.tsx` — `TongHopListPanel` (in, sửa, hủy). Ca nullable, cảnh báo mềm 3 case NVL-máy. In tách theo kho/máy qua `WarehouseSlipPrintModal`.

## Quy ước

- Phiếu nhập: header Nguồn nhập là chỗ lấy hàng (kho hoặc nhà cung cấp). Nhà cung cấp lọc mã từ kho NVL. Mỗi dòng là kho nhận hàng.
- Phiếu xuất: header Nguồn xuất là chỗ lấy hàng (kho hoặc máy). Mỗi dòng là nơi xuất đến (kho hoặc máy). Phiếu nhập không chọn ca.
- Header lưu `nguoi_lap`, `nguoi_giao`, `dia_diem`, `ly_do`, `ghi_chu`. Người lập chọn từ nhân sự `trang_thai = Đang làm`. Chạy lại `supabase-phieu-nhap-xuat-tong-hop.sql` nếu thiếu 3 cột mới.
- Ca chỉ lấy mục `loai_cai_dat = Thời gian` trong `/cai-dat`.
- `ten_kho` chỉ là tên kho. Máy ghi cột `may`. Row máy trên `nhap_kho`: `ma_may` có giá trị, `ten_kho=''`.
- Báo cáo kho cũ bỏ dòng `nhap_kho.ma_may` không rỗng.
- Không sửa `phieu_chuyen_kho`.
