# phieu_nhap_xuat_tong_hop

| | |
|---|---|
| **Bảng** | `phieu_nhap_xuat_tong_hop` |
| **Tab** | Form `phieu-nhap-xuat-tong-hop` → `/phieu-nhap-xuat-tong-hop`. Danh sách → `/danh-sach-phieu-nhap-xuat-tong-hop`. Hướng dẫn → `/huong-dan-nhap-nvl`. Theo dõi đợt–máy → `/nvl-theo-dot-may`. Mô phỏng nguồn → `/nvl-mo-phong` |
| **SQL** | `supabase-phieu-nhap-xuat-tong-hop.sql`, `supabase-nhap-kho-ma-may.sql` (`nhap_kho.ma_may`), `supabase-phieu-chi-phi-kem-theo.sql`, `supabase-phieu-nhap-xuat-tong-hop-dot-phan-xuong.sql` (`dot_san_xuat_id`, `dot_so`, `phan_xuong`, `phieu_xuat_goc_id`, `phieu_xuat_goc_ma`) |
| **Recipes** | `src/features/xuat-nhap-tong-hop/nvlProcessRecipes.ts` — 7 quy trình bán tự động (băm, tạo hạt, trộn màu, mua ngoài, xuất SX, nhập lại, phế) |

## API

| Method | Path | Ghi chú |
|--------|------|---------|
| GET/POST | `/api/xuat-nhap-tong-hop` | Header + ghi vế `phieu_nhap_kho` / `phieu_xuat_kho`. Vế NVL có kho ghi `id_danh_muc` + `loai_danh_muc = kho_nvl`. Kiểm tồn phiếu nhiều dòng gom mã theo nguồn và đọc theo lô; các dòng cùng nguồn/đích insert một lượt. |
| PUT | `/api/xuat-nhap-tong-hop/:id` | Sửa header, sinh lại vế, snapshot `phieu_xuat_nhap_kho_lich_su` |
| POST | `/api/xuat-nhap-tong-hop/:id/huy` | Phiếu đảo, không xóa vế lẻ |
| DELETE | `/api/xuat-nhap-tong-hop/:id` | Xóa vĩnh viễn header + các mã `ma_phieu_nhap` / `ma_phieu_xuat` / phiếu đảo liên quan |
| GET | `/api/xuat-nhap-tong-hop/ton` | Tồn dòng theo kho hoặc máy |
| POST | `/api/xuat-nhap-tong-hop/ton-danh-sach` | Tồn theo lô mã NVL trong kho, dùng để chỉ gợi ý vật liệu còn tồn |
| GET | `/api/ton-may?ma_may=` | Tồn NVL máy, đối chiếu `so_tron` / `bao_cao_may_nvl_ton` |
| POST | `/api/xuat-nhap-tong-hop/ma-moi` | Thêm mã NVL hoặc dòng `nhap_kho` (nhánh NVL bắt buộc `ten_kho` kho NVL đã có trong quản lý kho, lưu `ten_nvl_sx` + `phan_loai` + `loai_kho` theo unique `ma+ten+ten_sx+kho`; trùng unique trả dòng đang sống thay vì 500) |

## Frontend

`src/features/xuat-nhap-tong-hop/index.tsx` — `TongHopPanel` (form + **wizard quy trình**). `NvlDotMayPanel.tsx` — theo dõi xuất/nhập lại/phế theo đợt–máy–loại SX. `MoPhongNvlPanel.tsx` — trang mô phỏng nguồn dữ liệu mẫu. `list.tsx` — danh sách (+ cột Loại SX). `huong-dan-nhap-nvl` — hướng dẫn 7 quy trình. **Ca không bắt buộc**. **In đúng 1 phiếu** (`printSlips.ts`).

**Loại sản xuất:** UI label «Loại sản xuất» (Đặc/Sóng/Rỗng), lưu cột `phan_xuong`. Không tạo mới «Xuất/Nhập theo phân xưởng» — dùng «Xuất theo máy» + Loại SX (phân biệt Máy Sóng 1 chạy đặc/sóng). Phiếu cũ PX vẫn đọc được.

**Wizard bán tự động:** chọn quy trình + bước → prefill `loai_nhap`/`loai_xuat`, mã, kho; user sửa rồi lưu từng phiếu. Nhập lại: nút gợi ý kho từ phiếu xuất cùng đợt–máy. Nhập phế: validate SX01→Kho PC, SX06→Kho NVL Chính.

Khi xuất theo PTĐM, sau khi chọn phiếu tỷ lệ trộn định mức có thể mở ngăn trượt bên phải để xem các sản phẩm của lệnh sản xuất liên kết, theo các trường in trên phiếu lệnh. NVL trùng theo mã + tên sản xuất được cộng khối lượng thành một dòng trước; sau đó chọn một đơn giá cho dòng đã gộp.

API tests: `tests/api/nvlWarehouseFlow.test.ts` (opt-in integration test, 10 mã × 4 đơn giá, đủ 7 loại xuất; mặc định hủy phiếu và xóa danh mục test, đặt thêm `NVL_API_TEST_KEEP_DATA=1` để giữ dữ liệu cho kiểm tra UI). Chạy bằng `NVL_API_BASE_URL=<test-api>`, `NVL_API_TEST_ALLOW_WRITES=1`, rồi `npx tsx --test tests/api/nvlWarehouseFlow.test.ts`.

## Lô tồn NVL (trừ lùi theo lô)

- `supabase-nvl-lo-ton-counter.sql`: cột `so_luong_da_xuat` + `so_luong_con` (sinh sẵn) trên `phieu_nhap_kho`/`phieu_xuat_nhap_kho`, trigger `trg_nvl_lo_ton` trên bảng xuất (cộng/trừ lô, chặn xuất vượt tồn có khóa dòng), view đối soát `v_nvl_lo_ton_lech`.
- `server.ts` `buildNvlInboundLots`: đường nhanh đọc cột counter; thiếu cột → `buildNvlInboundLotsByScan` (cách cũ).
- UI: `lotAllocation.ts` (FIFO + giá bình quân), dòng vắt nhiều lô được tách theo lô khi lưu (`splitLinesByLot`).

## Quy ước phiếu xuất (kho vật tư)

- Ô `Người giao hàng` hiển thị `Người nhận hàng` ở mode xuất (nhập giữ nguyên); xem chi tiết tương tự (`ViewModal` theo `loai`).
- Lưới dòng xuất bỏ cột `Nhóm VTHH`, ẩn cột `Tồn đầu ca` (logic tồn + cảnh báo vượt tồn giữ nguyên).
- Cột **Giá** (nhập + xuất): dropdown giá đã từng nhập của mã NVL (`GET /api/phieu-xuat-kho/gia-nvl?ma_npl=`), vẫn cho gõ tay giá mới (`NvlPriceSelect`); hiển thị dấu phẩy ngăn nghìn, dấu chấm thập phân và giữ phần lẻ.

## Quy ước

- Xuất NVL: chọn đợt 1–10 bắt buộc trên form; API từ chối phiếu xuất NVL thiếu đợt hợp lệ. Có loại **Xuất theo máy** để chọn máy đích trực tiếp, không cần PTĐM. Danh sách lọc theo đợt và hiển thị cột Đợt để đối chiếu với máy/kho.

- Phiếu nhập: Nguồn Kho / Máy / NCC. Nhập lại / phế: máy nguồn + **Loại sản xuất** + đợt. Gợi ý kho nhập từ phiếu xuất cùng đợt–máy. Phế: SX01→Kho PC, SX06→Kho NVL Chính. Kho nhập chỉ Chính / Phụ / PC. Tên SX gõ + gợi ý (`revertOnBlurMismatch`).
- Phiếu xuất (UI mới): tỷ lệ trộn, **theo máy**, trả NCC, phế băm/cái, khác — **không** tạo «Xuất theo phân xưởng». Xuất máy SX thường: đợt + ca + máy + Loại sản xuất; chuyển phế cho máy băm/tạo hạt không cần đợt hoặc Loại sản xuất. Lưới Xuất từ kho/máy; vật liệu nguồn kho chỉ hiện khi còn tồn, lô chọn lọc có số dư dương; ô tìm NVL hỗ trợ nhiều từ khóa ngăn cách bằng dấu phẩy. Phiếu cũ PX vẫn đọc.
- Header lưu `nguoi_lap`, `nguoi_giao`, `dia_diem`, `ly_do`, `ghi_chu`. Người lập chọn từ nhân sự `trang_thai = Đang làm`. Chạy lại `supabase-phieu-nhap-xuat-tong-hop.sql` nếu thiếu 3 cột mới.
- Phiếu **SX**: bắt buộc ngày + đợt (1–10) + **Loại sản xuất** (cột `phan_xuong`). Xuất máy: tồn đầu ca (cho phép `0`).
- Quy trình băm / tạo hạt / trộn màu / mua ngoài: **wizard bán tự động** (`nvlProcessRecipes.ts`) gợi ý mã/kho/loại phiếu; chuyển PC→Chính/Phụ qua menu Chuyển kho. Mỗi nhập tạo lô giá; xuất trừ đúng `id_dong_nhap_nguon`.
- Ảnh số cân: tạm ẩn (`SHOW_NVL_ACTUAL_WEIGHT_IMAGE = false`).
- **Ca không bắt buộc** trên phiếu nhập và xuất (header `ca` / `ca_list`); nếu chọn nhiều ca thì phải cùng loại ca. Ca lấy mục `loai_cai_dat = Thời gian` trong `/cai-dat`. Nhập lại dùng ca đầu tiên (nếu có) để tham chiếu tồn cuối sổ trộn.
- `ten_kho` chỉ là tên kho. Máy ghi cột `may`. Row máy trên `nhap_kho`: `ma_may` có giá trị, `ten_kho=''`.
- Báo cáo kho cũ bỏ dòng `nhap_kho.ma_may` không rỗng.
- Không sửa `phieu_chuyen_kho`.
- Chi phí kèm theo **từng dòng**: nút «Chi phí» mở modal (`ChiPhiLineModal`) — chọn phiếu nhập + SL + giá theo phiếu, hoặc «Thêm chi phí khác». Lưu `chi_tiet[].chi_phi_kem_theo` (`ten`, `don_gia`, `thanh_tien`, tối đa 50 khoản). `thanh_tien` dòng hàng vẫn là SL × đơn giá. Mirror cột trên `phieu_nhap_kho` / `phieu_xuat_kho`.
