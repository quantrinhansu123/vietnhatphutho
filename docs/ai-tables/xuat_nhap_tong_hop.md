# phieu_nhap_xuat_tong_hop

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` |
| **Tab** | Form `phieu-nhap-xuat-tong-hop` → `/phieu-nhap-xuat-tong-hop`. Danh sách `phieu-nhap-xuat-tong-hop-list` → `/danh-sach-phieu-nhap-xuat-tong-hop` |
| **SQL** | `supabase-phieu-nhap-xuat-tong-hop.sql`, `supabase-nhap-kho-ma-may.sql` (`nhap_kho.ma_may`), `supabase-phieu-chi-phi-kem-theo.sql`, `supabase-phieu-nhap-xuat-tong-hop-dot-phan-xuong.sql` (`dot_san_xuat_id`, `dot_so`, `phan_xuong`, `phieu_xuat_goc_id`, `phieu_xuat_goc_ma`) |

## API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET/POST | `/api/xuat-nhap-tong-hop` | Header + ghi vế `phieu_nhap_kho` / `phieu_xuat_kho`. Vế NVL có kho ghi `id_danh_muc` + `loai_danh_muc = kho_nvl`. Kiểm tồn phiếu nhiều dòng gom mã theo nguồn và đọc theo lô; các dòng cùng nguồn/đích insert một lượt. |
| PUT | `/api/xuat-nhap-tong-hop/:id` | Sửa header, sinh lại vế, snapshot `phieu_xuat_nhap_kho_lich_su` |
| POST | `/api/xuat-nhap-tong-hop/:id/huy` | Phiếu đảo, không xóa vế lẻ |
| GET | `/api/xuat-nhap-tong-hop/ton` | Tồn dòng theo kho hoặc máy |
| GET | `/api/ton-may?ma_may=` | Tồn NVL máy, đối chiếu `so_tron` / `bao_cao_may_nvl_ton` |
| POST | `/api/xuat-nhap-tong-hop/ma-moi` | Thêm mã NVL hoặc dòng `nhap_kho` (nhánh NVL bắt buộc `ten_kho` kho NVL đã có trong quản lý kho, lưu `ten_nvl_sx` + `phan_loai` + `loai_kho` theo unique `ma+ten+ten_sx+kho`; trùng unique trả dòng đang sống thay vì 500) |

## Frontend

`src/features/xuat-nhap-tong-hop/index.tsx` — `TongHopPanel` (form). `list.tsx` — `TongHopListPanel` (in, sửa, hủy + lọc từ–đến ngày, đa chọn máy/kho; tải riêng nhập + xuất rồi gộp, khớp phiếu theo giá trị qua `thong-ke-nvl`: `buildPartyAliasKind`/`collectLineTokens`/`matchTokenFilter`, phiếu khớp khi có ≥1 dòng liên quan). **Ca bắt buộc** trên mọi phiếu nhập/xuất (multi-select cùng loại ca từ `/cai-dat`). **In đúng 1 phiếu** theo loại nhập/xuất (`printSlips.ts` → `WarehouseSlipPrintModal`): không tách xuất+nhập, không chia theo kho/máy.

API tests: `tests/api/nvlWarehouseFlow.test.ts` (opt-in integration test, 10 mã × 4 đơn giá, đủ 7 loại xuất; mặc định hủy phiếu và xóa danh mục test, đặt thêm `NVL_API_TEST_KEEP_DATA=1` để giữ dữ liệu cho kiểm tra UI). Chạy bằng `NVL_API_BASE_URL=<test-api>`, `NVL_API_TEST_ALLOW_WRITES=1`, rồi `npx tsx --test tests/api/nvlWarehouseFlow.test.ts`.

## Quy ước phiếu xuất (kho vật tư)

- Ô `Người giao hàng` hiển thị `Người nhận hàng` ở mode xuất (nhập giữ nguyên); xem chi tiết tương tự (`ViewModal` theo `loai`).
- Lưới dòng xuất bỏ cột `Nhóm VTHH`, ẩn cột `Tồn đầu ca` (logic tồn + cảnh báo vượt tồn giữ nguyên).
- Cột **Giá** (nhập + xuất): dropdown giá đã từng nhập của mã NVL (`GET /api/phieu-xuat-kho/gia-nvl?ma_npl=`), vẫn cho gõ tay giá mới (`NvlPriceSelect`).

## Quy ước

- Xuất NVL: chọn đợt 1–10 bắt buộc trên form; API từ chối phiếu xuất NVL thiếu đợt hợp lệ. Có loại **Xuất theo máy** để chọn máy đích trực tiếp, không cần PTĐM. Danh sách lọc theo đợt và hiển thị cột Đợt để đối chiếu với máy/kho.

- Phiếu nhập: Nguồn nhập mặc định là **Chọn nguồn nhập**, có thể chọn Kho / Máy / Nhà cung cấp. Nguồn Máy tạo vế xuất trừ tồn máy và vế nhập vào kho đã chọn; loại nhập lại/phế yêu cầu chọn máy nguồn. Riêng **Nhập lại theo phân xưởng** ẩn Nguồn nhập, bắt buộc chọn Đặc / Sóng / Rỗng, hiển thị danh sách máy áp dụng dạng chỉ đọc (Đặc: Máy Đặc 1 + Máy Sóng 1; Sóng: Máy Sóng 2 + Máy Sóng 1; Rỗng: Máy Rỗng) và không truy vấn/trừ tồn máy. Để trống nguồn ở loại khác thì không sinh vế xuất nguồn. Dropdown mã chỉ dòng `kho_nvl` của đúng kho nhập (khóa chọn là `id`, mã chỉ là nhãn; cùng mã khác tên sản xuất là các dòng khác nhau). Nếu chọn kho nguồn thì chỉ Kho NVL Chính, Kho NVL Phụ, Kho PC (nhà cung cấp cũng được). Cột Kho nhập chỉ ba kho đó. Tên sản xuất là ô gõ trực tiếp (có gợi ý các tên SX của cùng mã trong kho): chọn gợi ý thì gắn `id`, sửa text khác đi thì bỏ gắn `id` (ô highlight vàng, hover báo sẽ tạo mới) — gõ tìm rồi click ra ngoài mà không khớp thì hoàn lại lựa chọn cũ (`revertOnBlurMismatch`), chỉ Enter/bấm Thêm mới chốt tên mới. Gõ trùng tên đã có trong kho hoặc trùng dòng khác cùng phiên (cùng mã + tên + kho, không phân biệt hoa thường/khoảng trắng) thì tự gắn về `id`/chữ đã có, không tạo trùng. Phân loại NVL (`nvl_chinh` / `nvl_phu`) ghi `phan_loai_nvl` trên vế phiếu và `phan_loai` trên dòng `kho_nvl` mới (hoặc dòng kho nhận đang trống phân loại).
- Phiếu xuất: **Loại xuất** cố định (xuất theo phiếu tỷ lệ trộn, **xuất theo phân xưởng**, trả nhà cung cấp, phế băm, phế cái, xuất khác). Header **Xuất đến** chọn kho hoặc máy (trả NCC thì chọn nhà cung cấp). Loại “xuất theo phân xưởng” hiện ô **Xuất đến phân xưởng** (Đặc/Sóng/Rỗng) thay cho **Xuất đến** — đích `dich_*` = `phan_xuong`, chỉ trừ nguồn, không chọn máy. Loại “xuất kho cho máy theo phiếu tỷ lệ trộn” chọn máy ở Xuất đến; danh sách lệnh/PTĐM chỉ hiện các phiếu thuộc máy đang chọn, và tick PTĐM tự điền máy + NVL. Đổi máy thì bỏ các PTĐM/dòng NVL đã điền từ máy cũ. Lưới **Xuất từ** từng dòng chọn kho hoặc máy, không khóa cứng. Chọn kho thì dropdown mã chỉ NVL của đúng kho đó (`ten_kho` trùng, hoặc `ten_kho` trống và `loai_kho` = mã kho). Khi điền từ PTĐM, `material_id` gắn dòng kho đang sống và Xuất từ lấy `ten_kho` của dòng đó; không khớp thì bỏ id, hiện mã/tên SX (ô vàng), không hiện UUID. Giá trị chọn là `kho_nvl.id`, không gộp theo mã. Vế xuất NVL **không tự tạo/sửa master `kho_nvl`** — chỉ gắn `id_danh_muc` đang sống, tên / tên sản xuất sai kho nguồn thì lỗi 400. ĐVT trên lưới xuất là read-only theo danh mục. Chọn **Giá** trực tiếp trên lưới; hệ thống tự gắn lô FIFO còn đủ số lượng để trừ tồn (`id_dong_nhap_nguon` từ `GET /api/phieu-xuat-kho/lo-ton`), không cần chọn lô. Các cột còn lại: ngày tồn, ca, tồn đầu ca, SL CT, SL thực, quy đổi kg, thành tiền. Xuất từ máy không chọn lô kho. **Ảnh số cân thực tế đang tạm ẩn** (`SHOW_NVL_ACTUAL_WEIGHT_IMAGE = false`); API vẫn giữ `link_anh_can_thuc_te`. Mỗi dòng nhập tạo lô tồn theo giá (id dòng nhập). Đích máy chỉ ghi vế xuất. Phiếu cũ vẫn đọc được.
- Header lưu `nguoi_lap`, `nguoi_giao`, `dia_diem`, `ly_do`, `ghi_chu`. Người lập chọn từ nhân sự `trang_thai = Đang làm`. Chạy lại `supabase-phieu-nhap-xuat-tong-hop.sql` nếu thiếu 3 cột mới.
- Phiếu **SX** (xuất máy / nhập lại / phế / tạo hạt–băm): bắt buộc **ngày + đợt**; **Đợt sản xuất** là select cố định **Đợt 1 … Đợt 10** (lưu `dot_so` = `"1"`…`"10"`, không lấy từ bảng `dot_san_xuat`). Ô **Xuất đến phân xưởng** chỉ hiện khi loại xuất = **Xuất theo phân xưởng** (ẩn Xuất đến máy/kho). Các loại xuất khác không hiện / không bắt buộc phân xưởng. Xuất đến máy bắt buộc **tồn đầu ca** (cho phép `0`). Phiếu **nhập** không dùng **phiếu xuất gốc**. Nhập lại / phế: chọn máy (+ ca) để tham chiếu tồn cuối sổ trộn.
- Quy trình băm / tạo hạt / trộn màu: dùng loại phiếu nhập–xuất–chuyển kho thủ công (đã có trong `LOAI_*_OPTIONS`); **không** công thức chuyển mã. Mỗi nhập tạo lô giá; mỗi xuất từ kho trừ đúng `id_dong_nhap_nguon`.
- Ảnh số cân: tạm ẩn (`SHOW_NVL_ACTUAL_WEIGHT_IMAGE = false`).
- **Ca bắt buộc** trên phiếu nhập và xuất (header `ca` / `ca_list`); chọn ≥1 ca cùng loại ca. Ca lấy mục `loai_cai_dat = Thời gian` trong `/cai-dat`. Nhập lại dùng ca đầu tiên để tham chiếu tồn cuối sổ trộn.
- `ten_kho` chỉ là tên kho. Máy ghi cột `may`. Row máy trên `nhap_kho`: `ma_may` có giá trị, `ten_kho=''`.
- Báo cáo kho cũ bỏ dòng `nhap_kho.ma_may` không rỗng.
- Không sửa `phieu_chuyen_kho`.
- Chi phí kèm theo nằm trong `chi_tiet[].chi_phi_kem_theo` (`ten`, `don_gia`, `thanh_tien`, tối đa 50 khoản). `thanh_tien` dòng hàng vẫn là SL × đơn giá. Tổng KL / Tổng hàng / Tổng kèm / Tổng cộng chỉ tính khi hiển thị. Mirror cột `chi_phi_kem_theo` trên `phieu_nhap_kho` và `phieu_xuat_kho`; không đụng `phieu_xuat_nhap_kho`. Chạy `supabase-phieu-chi-phi-kem-theo.sql`.
