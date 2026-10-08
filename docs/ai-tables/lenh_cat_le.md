# lenh_cat_le

| | |
|---|---|
| **Bảng** | `lenh_cat_le` |
| **Tab** | `lenh-cat-le` → `/lenh-cat-le` (card **Lệnh cắt lẻ** trong `/nha-may/kho`) |
| **SQL** | `supabase-lenh-cat-le.sql` (bảng + seed `Kho cắt lẻ`/`Kho tái chế`), `supabase-nhap-kho-cat-le.sql` (7 cột thông số ghép tên trên `nhap_kho`) |

## Vai trò

Một lệnh chọn **nhiều sản phẩm**. Cột lưu: `kho_nguon`, `kho_dich`, `kho_tai_che`, JSON `san_pham`, mã phiếu, người thực hiện/lập, ghi chú.
Mỗi phần tử JSON: `san_pham_nguon`, `san_pham_cat_1` (nhập thành phẩm), `san_pham_cat_2` (phần còn lại), `di_tai_che`, cùng ô form `sl_can`, `sl_bac`, `sl_trung`, `sl_nam`, `dinh_muc_kg`, `tong_kg`, `tem`, `mau_tem`, `dan_tem_2_dau` để bấm Sửa đổ lại.
Không có cột nguồn/cắt, `kho_tp`, hay `di_tai_che` trên bảng — `CREATE TABLE` trong `supabase-lenh-cat-le.sql` đã là schema cuối (chưa chạy trên Supabase, không có `ALTER`).

**Tạo mới / Sửa** chỉ lưu lệnh trạng thái `moi` (chờ duyệt), không ghi kho.
Trong form, khi đủ thông tin sản phẩm có nút **Xác nhận**: xem sản phẩm nguồn cắt thành cắt 1 / cắt 2 (mã, tên, số lượng, kg/m²/m dài và thông số sẽ ghi `nhap_kho`).
Bấm **Duyệt** (`POST /:id/hoan-thanh`) mới xuất **kho chính** (Kho Đặc/Kho Sóng theo SP), nhập **Kho thành phẩm**, nhập mọi phần còn lại lại **kho nguồn** (mọi chiều dài, mọi máy — không nhập Kho tái chế). Sau khi duyệt (`hoan_thanh`) không sửa được.

- Được hạ một chiều (xẻ khổ giữ dài / cắt ngắn giữ rộng) hoặc hạ cả khổ lẫn m dài (`kieu_cat = ca_hai`). Độ li đích đổi riêng được: khi đổi, `do_day_m` của sản phẩm cắt ghép lại theo số li (vd `1` → `1m`) rồi ghi `nhap_kho`; phần còn lại giữ `do_day_m` nguồn. Hạ khổ thì khổ còn lại = khổ nguồn − khổ cắt, m dài phần còn lại giữ của nguồn. Tên SP cắt và phần còn lại nối thêm `mo_ta_tem` của nguồn.
- **Kho nguồn suy từ nhóm VTHH** (`inferKhoChinhTuNhom` trong `logic.ts`): Đặc → `Kho Đặc`; Sóng/Rỗng → `Kho Sóng` (rỗng chung kho sóng). Form gửi kho suy luận; server fallback khi lệnh thiếu kho.
- **Mã mới + mã cũ:** SP cắt / phần thừa mang `ma_amis` = mã MỚI (sinh bằng `buildMaAmisMoi` từ mã gốc + khổ rộng hạ + mét cắt + màng) + `ma_amis_cu` = mã gốc — tính lúc lập dòng (`buildCatLeSanPhamLine`), giữ qua `normalizeCatLeSanPhamList`. Ô **Hạ khổ rộng (m)** trống thì giữ khổ nguồn; có số khác khổ nguồn thì ghi `*Nm` vào mã mới. Duyệt lệnh upsert biến thể vào `san_pham` (tìm theo `ma_amis + ten_sp`, cần migration `supabase-san-pham-ma-amis-cu.sql`); phiếu xuất/nhập và catalog `nhap_kho` ghi `ma_sp` = mã mới + `ma_sp_cu` = mã gốc (migration `supabase-nhap-kho-ma-sp-cu.sql`, để tổng hợp về sau).
- **Tạo từ đơn cắt lẻ:** modal lập lệnh có picker chỉ load `Đơn theo quy cách của khách đặt` — chọn đơn + dòng SP tự điền nguồn (theo `ma_sp` gốc), m cắt (theo `quy_cach_m_dai`/`dai_m`), SL và ghi chú kèm `ma_amis` mới/`ten_ghep`.
- Gốc trọng lượng là 3 hệ số 1 SP của nguồn (`kg/m2/m dài`): `kg2 = kg1 × (w2×l2)/(w1×l1)`.
  Mất số nguồn thì nhập kg cân tay. Chuỗi cắt (20m→12m→10m) lấy TP làm nguồn qua `parent` logic.

## API (`server.ts`, sau `/api/ton-kho-thanh-pham`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/lenh-cat-le` (?trang_thai) | Danh sách mới nhất trước |
| POST | `/api/lenh-cat-le` | `sanPham[]`: lưu lệnh `moi`, chưa ghi kho |
| PUT | `/api/lenh-cat-le/:id` | Sửa lệnh `moi`. Đã duyệt thì từ chối |
| DELETE | `/api/lenh-cat-le/:id` | Xóa lệnh `moi` |
| POST | `/api/lenh-cat-le/:id/hoan-thanh` | **Duyệt**: đối soát tồn → xuất/nhập → `hoan_thanh` |
| POST | `/api/lenh-cat-le/:id/huy` | Hủy nháp (chỉ `moi`) |

`nhap_kho` raw + tồn kỳ đã kèm specs (`ten_goc/do_li/do_li_dm/do_day_m/do_dai_m/mang/hang_phe/ma_amis`,
resilient khi DB chưa migrate) — xem [nhap_kho.md](./nhap_kho.md).

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/lenh-cat-le/index.tsx` | Modal lớn + danh sách (lọc Từ ngày/Đến ngày/Tìm SP/**Trạng thái**, cột Người TH + **Người lập**). Nguồn mẹ tải từ **Kho Đặc + Kho Sóng + Kho cắt lẻ** (chọn mẹ hiện tên kho). Xác nhận và Xem trước phiếu (bản tạm): 1 phiếu xuất kho chính sản phẩm nguồn, nhập thành phẩm, nhập mọi phần còn lại về kho nguồn. Duyệt mới ghi kho |
| `src/features/lenh-cat-le/logic.ts` | Pure: `computeCatLe` (tên + quy đổi; phần thừa luôn về kho cắt lẻ), `motherFromNhapKhoRow`, parse/format mét |
| `tests/unit/lenhCatLe.test.ts` | Chuỗi 20m→12m→10m, xẻ khổ, validate, cân tay |

## Không đọc

`App.monolith.backup.tsx` — logic phiếu TP xem [phieu_xuat_nhap_kho.md](./phieu_xuat_nhap_kho.md).
