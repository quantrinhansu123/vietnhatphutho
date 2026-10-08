# don_hang

| | |
|---|---|
| **Bảng** | `don_hang` |
| **Tab** | `orders` → `/don-hang` |
| **SQL** | `supabase-don-hang-*.sql` (bao gồm `supabase-don-hang-updated-at.sql`, `supabase-don-hang-soft-delete.sql`) |

## API (`server.ts`)

| Method | Path | Dòng |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/don-hang` | 7475–7645 |
| POST | `/api/don-hang/:id/restore` | khôi phục xóa mềm |

### Xóa mềm (soft delete)

- Cột `deleted_at` (+ `deleted_by`, migration `supabase-don-hang-soft-delete.sql`).
- `GET /api/don-hang` mặc định ẩn đã xóa; `?includeDeleted=1` để xem thùng rác.
- `DELETE` → xóa mềm; `?hard=1` → xóa vĩnh viễn. Frontend có nút "Đơn đã xóa" (khôi phục / xóa vĩnh viễn).
- `POST /api/lenh-sx/from-don-hang/:id` từ chối đơn đã xóa mềm.

Helper parse/lưu JSON `san_pham` (kèm `stt`): ~4986–5550.
Helper bổ sung quy đổi theo cờ thay đổi từ form sửa: ~5376–5455.
Helper tự sinh mã: `generateNextOrderCodeFromDb()` ~2924.

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/don-hang/index.tsx` | Panel / logic chính |
| `src/components/shared/Select2.tsx` | Select khách hàng (gõ để tìm) trên form thêm/sửa |
| `src/features/_shared/orderHelpers.ts` | Panel / logic chính |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/features/_shared/` | Helper dùng chung (storage, hr, recordHelpers) |


## Liên kết

Tạo lệnh SX: `POST /api/lenh-sx/from-don-hang/:id`

### Form đơn hàng

- **Khách hàng**: Select2 (gõ để tìm) lấy từ `/api/khach-hang` (bảng danh mục Khách hàng), bắt buộc chọn.
- **Sản phẩm JSON `san_pham`**: mỗi object có `stt` (1, 2, 3…) theo thứ tự dòng. Form thêm/sửa: kéo thả hoặc cụm action cố định `[Xóa] [↑] [↓]` bên phải; Lên/Xuống disabled ở đầu/cuối. Lưu luôn chuẩn hóa `stt` liên tục. Dữ liệu cũ chưa có `stt` hiển thị theo vị trí mảng.
- **Quy đổi khi thêm/sửa**: tải `san_pham_quy_doi`, áp dụng quy tắc nhóm VTHH và công thức tại `.ai/spec/tinh_toan_quy_doi.md`. Khi sửa, dòng chưa bị tác động hiển thị/giữ nguyên quy đổi trong JSON `san_pham`; chỉ tính theo bảng mới sau khi người dùng đổi dữ liệu ảnh hưởng quy đổi hoặc chọn lại sản phẩm cũ.
- Dòng JSON `san_pham` lưu mã AMIS, `ten_san_xuat`, `ten_ghep` và mảng `ket_qua_quy_doi`; thiếu cấu hình quy đổi vẫn cho phép lưu đơn.
- **Loại đơn**: `Đơn bán / Đơn sản xuất / Đơn theo quy cách của khách đặt / Đơn cắt lẻ / Đơn miền nam` (`ORDER_TYPE_OPTIONS`). `Đơn cắt lẻ` là tên mới cùng hành vi cắt với `Đơn theo quy cách của khách đặt` (nhận diện chung qua `isCutOrderType`, server `isCutOrderTypeServer`); đơn cũ giữ nguyên tên vẫn chạy.
- **`ma_amis` / `ma_amis_cu` dòng biến thể**: đơn miền nam sinh mã mới bằng `buildMaAmisMoi`. Đơn cắt lẻ sinh bằng `buildCutAmisCodeFull` từ tên sản xuất (viết tắt màu / ZEM / số sóng / kg) cộng TC/phế, màng, khổ, mét dài, tem. `ma_amis_cu` = mã gốc, `ma_sp` giữ mã gốc; BE passthrough trong `parseOrderProductsFromRow`/`parseProductionOrderProductsInput`/`buildProductionOrderRecordFromOrder` (`server.ts`).
- **`ten_ghep`**: luôn lưu cho mọi loại đơn, **lấy từ `ten_ghep` đã lưu trên danh mục SP** (`OrderProductOption.tenGhep`; thiếu mới ghép lại từ `ten_san_xuat`). Đơn cắt lẻ: nhóm **Đặc/Sóng** thay đúng token **m dài chính** (`doDaiM` trên SP) thành mét cắt (`replaceCutLengthMeters` — kể cả khi m dài không đứng cuối, vd `…6m - 2.1m` cắt 8m → `…8m - 2.1m`); các nhóm VTHH khác giữ luật cũ (thay token mét cuối, thiếu thì thêm `- Nm`). Danh sách, chi tiết và in đơn hàng **chỉ** hiển thị `ten_ghep` đã lưu trong JSON `san_pham` — không ghép lại, không nối thêm dòng tem (tem đã nằm trong `ten_ghep`). In đơn hàng và lệnh SX (thêm/sửa) hiển thị và lưu `ten_ghep`.
- **Ngày giao hàng**: cột `ngay_giao_hang`, migration `supabase-don-hang-ngay-giao-hang.sql`.
- **ĐVT dòng đơn**: theo `allowedOrderUnits` (`src/features/_shared/orderHelpers.ts`) — Đặc/Sóng: `Tấm`/`Cuộn`; Rỗng: `Tấm`; còn lại: `kg`. Phân loại nhóm qua `classifyProductGroupKind` (chứa từ khóa, không tuyệt đối) nên biến thể nhóm (`TP;PX Đặc`, `Đặc`…) vẫn ra `Tấm`/`Cuộn`.
- **KG khách hàng nhập**: cột KG/Tổng KG trên mọi loại đơn cho phép nhập tay. Khi có giá trị, JSON `san_pham[]` ưu tiên `tong_kg` này, ghi `nguon_quy_doi = "khach_hang_nhap_kg"`, cập nhật `ket_qua_quy_doi`; nếu ĐVT là Tấm/Cuộn thì suy ra `tl_tam`/`tl_cuon = tong_kg / so_luong`. Backend giữ nguồn nhập tay, không ghi đè bằng định mức danh mục.
- **Mọi loại đơn**: nút `+` xanh nằm trong ô STT (ngoài cùng bên trái, ngay sau số thứ tự), click nhân bản toàn bộ sản phẩm thành dòng ngay bên dưới. Nút lên/xuống cũng nằm trong ô STT; cột thao tác cuối chỉ còn nút xóa. Cột STT rộng 7rem.
- **Đơn cắt lẻ và Đơn miền nam dùng chung một lưới form** (vì cắt lẻ vẫn phải hạ khổ, hạ li và đổi định mức): Mã AMIS / Tên sản xuất / ĐVT — mặc định `Tấm`, SP Đặc/Sóng chọn được `Tấm`/`Cuộn` qua `resolveCutOrderLineUnit` / Dài m / **Khổ rộng (m)** (miền nam) hoặc **Hạ khổ rộng (m)** (cắt lẻ) — JSON `kho` / **Độ li ĐM** / **Định mức KG** / Bắc-Trung-Nam / SL tổng / Tổng KG / **Tem** / **Màu tem** / **2 Đầu** / Ghi chú. Khổ khác `do_day_m` danh mục thì `buildMaAmisMoi` thay token `*Nm` (không có thì chèn `*Nm`) và `replaceCutWidthMeters` sửa tên ghép. **Tem** (`SOUTH_TEM_OPTIONS`: 11 loại `1.2li…5li` gợi ý, cho nhập tay qua `allowCustomValue`), **Màu tem** (`Hồng` gợi ý mặc định ở placeholder + `Vàng`/`Trắng`/`Xanh`, cho nhập tay qua `allowCustomValue`, dropdown hiển thị nhãn `Tem Hồng (MVCC)`… qua `southTemColorLabel` nhưng giá trị lưu vẫn là tên màu gốc) và checkbox **Dán Tem 2 Đầu**. **Tem / Màu tem / 2 Đầu độc lập**: chọn tem không tự điền màu, xóa tem không tự xóa màu/tick — lưu đúng như màn hình, màu trống thì không tự mặc định (FE `orderProductLinesToPayload`, BE mirror trong `server.ts` cho mọi `isCutLikeOrderTypeServer`). Hậu tố tên ghép từng phần riêng (`(Dán Tem X)` / `Màu Y MV…` / `Dán Tem 2 Đầu`) nên màu hoặc tick lẻ không kèm tem vẫn lên tên; strip/parse (FE + BE + `extractTemSuffix` cắt lẻ) bóc được cả suffix không tem, tránh nối lặp khi sửa. Ô **Độ li ĐM** chỉ nhập/hiển thị **số** (vd `0.75`); khi lưu tự thành `do_li_dm = (đm n li)` và chỉ thay segment `(đm …)` trong `ten_ghep`, **không** đổi token `do_li`. Màu lạ (không phải Vàng) quy MV về MVCC. Màng KHÔNG nối thêm (đã có trong tên gốc). JSON `san_pham[]` lưu `tem`, `mau_tem`, `dan_tem_2_dau`, `do_li_dm`, và `mo_ta_tem` (hậu tố tem đã trim, vd `(Dán Tem 1.5li) Màu Hồng MVCC Dán Tem 2 Đầu`; bỏ key khi không chọn tem); `ten_ghep` = tên ghép (đã thay mét + đm) + hậu tố Full Excel ` (Dán Tem 5li) Màu Hồng MVCC` (+ ` Dán Tem 2 Đầu` nếu tick), MV tự động theo màu (Hồng→MVCC, Vàng→MVKH, Trắng→MVPY, Xanh→MVGL; màu lạ quy về MVCC). Backend validate `dai_m > 0`, tính quy đổi như nhau. In (`OrderPrintSheet`): miền nam tiêu đề `ĐƠN ĐẶT HÀNG MIỀN NAM`, tên dòng là `ten_ghep`. **Đơn cắt lẻ** in theo mẫu giấy (`ĐƠN ĐẶT CẮT LẺ`, cột STT / Tên hàng / ĐVT / Kích thước Khổ + Dài (m) / Số lượng / Ghi chú). **Tên hàng = `ma_amis` mới** (chưa có biến thể thì mã gốc). **Khổ** in từ ô khổ rộng khi có nhập, không thì lấy từ tên sản xuất gốc. **Dài (m)** dùng ô form khi khác mét dài danh mục, không đổi thì giữ số gốc. Độ li ĐM đổi thì nằm trong mã AMIS mới, không ghi đè khổ.
- **Định mức KG (đơn cắt lẻ + miền nam)**: cột `Định mức KG` (kg/tấm) trên lưới form, sau `Độ li ĐM` và trước Bắc/Trung/Nam. Có giá trị > 0 thì `Tổng KG = Định mức × SL tổng` (ưu tiên hơn cả KG nhập tay), `tl_tam = Định mức`, `tl_cuon` giữ theo danh mục, `nguon_quy_doi = khach_hang_nhap_kg` để backend giữ số. JSON `san_pham[]` lưu thêm `dinh_muc_kg` (passthrough ở `parseOrderProductsInput`/normalize/read/lệnh SX trong `server.ts`, restore khi sửa đơn qua `orderRecordHelpers` + `orderToForm`).
- **Đơn miền nam (cột Màng & tự động fill)**:
  - Bổ sung cột **Màng** dạng ô input (mặc định là `SUN PC`, người dùng có thể xóa đi hoặc viết lại tùy ý).
  - Khi người dùng chọn **Tên sản xuất** (hoặc chọn Mã AMIS), hệ thống **tự động fill các cột phía sau nếu có**: Màng (`SUN PC` hoặc trích xuất từ tên/danh mục), ĐVT, Dài (m), Khổ rộng (m), Độ li ĐM, Độ dài tấm tiêu chuẩn (m), Định mức tiêu chuẩn (kg), Tem, Màu tem, Dán tem 2 đầu từ dữ liệu của sản phẩm và bảng quy đổi. Cột KG/1m và Tổng KG tự động tính toán ngay sau khi có thông số.

