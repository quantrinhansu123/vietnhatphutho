# so_che_do_may

| Bảng | `so_che_do_may` |
| Tab | `so-che-do-may` → `/so-che-do-may` + `so-che-do-may-list` → `/danh-sach-so-che-do-may` (card trong `/bao-cao-truong-ca-tron`, vào từ `/nha-may/cong-nhan`) |
| SQL | `supabase-so-che-do-may.sql` (+ migration `supabase-so-che-do-may-ma-may.sql` nếu đã tạo bảng từ bản cũ) |

## API (`server.ts`)

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/so-che-do-may` | `?thang&nam&ma_may&limit` (tối đa 300), sort `nam desc, thang desc` |
| POST | `/api/so-che-do-may` | unique `(ma_may, thang, nam)` — trùng trả 409 |
| PUT | `/api/so-che-do-may/:id` | cập nhật toàn bộ sổ tháng |
| DELETE | `/api/so-che-do-may/:id` | xóa sổ tháng |

## Frontend

| File | Nội dung |
|------|----------|
| `src/features/so-che-do-may/index.tsx` | Màn hình duy nhất (`SoCheDoMayWorkspace`: props `onBack` — 2 route `so-che-do-may` + `so-che-do-may-list` cùng render; dropdown multiple tìm/chọn máy sinh section, checkbox trước tên máy ở section để tick lưu/in, lưu cả lô, khóa sửa theo `useTabAccess('so-che-do-may-list')`) + lưới dùng chung (`SoCheDoMayGrid`) + modal ghi chú (`NoteModal`) + ô bàn giao (`HandoverCell`) + picker lịch popup (`MonthYearPicker` tháng/năm, `VnCalendarPicker` ngày). |
| `src/App.tsx` | Shell routing — import panel, không chứa logic bảng |
| `src/routes.ts` | `so-che-do-may` → `/so-che-do-may`, `so-che-do-may-list` → `/danh-sach-so-che-do-may` |
| `src/app/menus.tsx` | Cards trong `BAO_CAO_TRUONG_CA_TRON_MENU_ITEMS` |
| `src/app/tabAccess.ts` | Alias `so-che-do-may` → `so-che-do-may-list` + hub implied tabs |
| `src/features/so-che-do-may/print.ts` | In phiếu đã chọn khổ ngang A4 (`printSoCheDoMaySlips`, mỗi máy 1 trang). |

## Nghiệp vụ

- **Chọn kỳ + máy:** picker Tháng + Năm kiểu lịch popup tiếng Việt (`MonthYearPicker`, năm 1–2999). Dropdown multiple tìm/chọn máy (`SearchableMultiSelect` + tick Tất cả) để sinh section; mỗi section có **checkbox ngay trước tên máy** để tick chọn đưa vào lưu/in (máy mới mặc định được tick). Chọn xong tháng + máy thì **tự sinh lưới nhập liệu theo từng máy** (mỗi máy 1 section gập/mở, sổ cũ fill sẵn, sổ chung cũ fill sang máy mới).
- **In:** nút In phiếu đã chọn in các máy đã tick ra khổ ngang A4 (mỗi máy 1 trang, đúng dữ liệu đang hiển thị, kể cả phiếu chưa có dữ liệu).
- **Lưới tháng:** 8 khu vực máy cố định (`KHU_VUC_MAY_CHE_DO`) x 3 ca (`C1/C2/C3`), cột ngày = số ngày thực của tháng/năm (tự tính, dùng được tới năm 2999). Bấm ô ngày để xoay `trống → v → x`.
- **Cố định + cuộn:** Stt / Khu vực máy / Ca `position: sticky` trái, các cột ngày cuộn ngang (`table-layout: fixed`, cột ngày 38px).
- **Bàn giao:** mỗi ngày 2 ô (bàn giao / nhận) search trong bảng `nhan_su` (`/api/nhan-su?format=groups&scope=all`), lọc `phong_ban` = Phân xưởng sản xuất (so khớp không dấu, không phân biệt hoa thường); nút chỉ hiện tên cuối, `title` = đầy đủ họ tên, chữ dọc.
- **Ghi chú:** modal Từ/Đến bằng lịch popup tiếng Việt (`VnCalendarPicker`: tuần Thứ 2–CN, năm 1–2999) + đa chọn máy load toàn bộ danh mục (`SearchableMultiSelect`, trống = tất cả máy) + nội dung; lưu xong vẽ khối dọc gộp đúng phần ngày giao với tháng sổ (đo `offsetWidth/offsetHeight` thực để canh khớp), lọc theo phạm vi máy của sổ đang xem; ghi chú không thuộc máy nào trong lô lưu sẽ bị bỏ qua kèm cảnh báo.
- **Một màn hình:** vào trắng, chọn tháng + năm + máy thì lưới tự sinh (có dữ liệu tự điền). Sổ có sẵn cần `canEdit`, sổ mới cần `canCreate` mới sửa được; nút Lưu/Xóa cần `canWrite`/`canDelete` — thiếu quyền thì chỉ xem.
- **Lưu cả lô (insert-or-update):** 1 nút lưu hết máy đã chọn (mỗi máy 1 sổ = 1 máy + 1 tháng + 1 năm; `o_che_do` map `<kv>_<ca>_<ngày>`, `ban_giao` theo ngày); chưa có thì POST, có rồi thì PUT, POST trùng 409 tự tải về rồi PUT; ghi chú chung tự lọc theo phạm vi máy khi lưu từng sổ; báo kết quả từng máy.

## Liên kết

`nhan_su` (công nhân sản xuất)
