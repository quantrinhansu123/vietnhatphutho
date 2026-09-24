# lenh_cat_le

| | |
|---|---|
| **Bảng** | `lenh_cat_le` |
| **Tab** | `lenh-cat-le` → `/lenh-cat-le` (card **Lệnh cắt lẻ** trong `/nha-may/kho`) |
| **SQL** | `supabase-lenh-cat-le.sql` (bảng + seed `Kho cắt lẻ`/`Kho tái chế`), `supabase-nhap-kho-cat-le.sql` (7 cột thông số ghép tên trên `nhap_kho`) |

## Vai trò

Một lệnh chọn **nhiều sản phẩm**. Cột lưu: `kho_nguon`, `kho_dich`, `kho_tai_che`, JSON `san_pham`, mã phiếu, người thực hiện/lập, ghi chú.
Mỗi phần tử JSON: `san_pham_nguon`, `san_pham_cat_1` (nhập thành phẩm), `san_pham_cat_2` (phần còn lại), `di_tai_che`.
Không có cột mẹ/con, `kho_tp`, hay `di_tai_che` trên bảng — `CREATE TABLE` trong `supabase-lenh-cat-le.sql` đã là schema cuối (chưa chạy trên Supabase, không có `ALTER`).

**Tạo mới / Sửa** chỉ lưu lệnh trạng thái `moi` (chờ duyệt), không ghi kho.
Trong form, khi đủ thông tin sản phẩm có nút **Xác nhận**: xem sản phẩm nguồn cắt thành cắt 1 / cắt 2 (mã, tên, số lượng, kg/m²/m dài và thông số sẽ ghi `nhap_kho`).
Bấm **Duyệt** (`POST /:id/hoan-thanh`) mới xuất **Kho cắt lẻ**, nhập **Kho thành phẩm**, nhập phần còn lại lại **Kho cắt lẻ**.
Phần còn lại **dưới 2m** nhập thẳng **Kho tái chế** (không xuất, vì sản phẩm còn lại chưa có tồn ở Kho cắt lẻ). Từ 2m thì nhập lại Kho cắt lẻ. Sau khi duyệt (`hoan_thanh`) không sửa được.

- Được hạ một chiều (xẻ khổ giữ dài / cắt ngắn giữ rộng) hoặc hạ cả khổ lẫn m dài (`kieu_cat = ca_hai`). Độ li đích đổi riêng được: khi đổi, `do_day_m` của sản phẩm cắt ghép lại theo số li (vd `1` → `1m`) rồi ghi `nhap_kho`; phần còn lại giữ `do_day_m` mẹ. Hạ khổ thì khổ còn lại = khổ mẹ − khổ cắt, m dài phần còn lại giữ của mẹ. Tên SP cắt và phần còn lại nối thêm `mo_ta_tem` của mẹ.
- Gốc trọng lượng là 3 hệ số 1 SP của mẹ (`kg/m2/m dài`): `kg2 = kg1 × (w2×l2)/(w1×l1)`.
  Mất số mẹ thì nhập kg cân tay. Chuỗi cắt (20m→12m→10m) lấy con làm mẹ qua `parent` logic.

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
| `src/features/lenh-cat-le/index.tsx` | Modal lớn. Xác nhận và Xem trước phiếu (bản tạm): 1 phiếu xuất Kho cắt lẻ sản phẩm nguồn, nhập thành phẩm, nhập phần còn lại từ 2m về Kho cắt lẻ, phần dưới 2m chỉ nhập Kho tái chế. Duyệt mới ghi kho |
| `src/features/lenh-cat-le/logic.ts` | Pure: `computeCatLe` (tên + quy đổi + rule <2m), `motherFromNhapKhoRow`, parse/format mét |
| `tests/unit/lenhCatLe.test.ts` | Chuỗi 20m→12m→10m, xẻ khổ, validate, cân tay |

## Không đọc

`App.monolith.backup.tsx` — logic phiếu TP xem [phieu_xuat_nhap_kho.md](./phieu_xuat_nhap_kho.md).
