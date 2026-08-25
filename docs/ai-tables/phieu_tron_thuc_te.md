# phieu_tron_thuc_te

| **Bảng** | `phieu_tron_thuc_te` |
| **Tab** | `/danh-sach-bao-cao-phoi-tron` → **Phiếu trộn thực tế** |
| **SQL** | `supabase-phieu-tron-thuc-te.sql` |

**API:** `/api/phieu-tron-thuc-te`  
**UI:** `src/components/ActualMixingSheetTab.tsx`

Mỗi phiếu tham chiếu một `dinh_muc_id` của đúng `ngay` + `ca`.

## Cối trộn tiêu chuẩn — không sửa, không tự chia cối

Mỗi SP-block hiển thị 1 khối **"Cối trộn tiêu chuẩn"** đọc thẳng từ `chi_tiet[].nvl` (+ `dinh_luong_coi`) của phiếu **định mức** (`bang_tron_vat_tu_dinh_muc`) — read-only, cùng bố cục cột với bảng cối tiêu chuẩn bên Phiếu trộn định mức (Mã NVL, Tên NVL, Tên NVL SX, Giá trị, % Cối trộn, % Tổng SL, Tổng trọng lượng).

Danh sách cối trộn **thực tế** không còn tự sinh theo `so_lan_tron`/`lan_tron` của định mức — mặc định rỗng, người dùng bấm **"+ Thêm cối trộn"** từng cối một (nút xoá cối ở mỗi khối, xoá xong tự đánh lại số thứ tự liên tục).

## Công thức mỗi cối trộn thực tế

Mỗi cối có 1 ô nhập **"Tổng KL cối thực tế"** (kg, người cân thực tế nhập). Khi nhập, hệ thống tự tính cho từng dòng NVL:

```
%CốiChuẩn(i)   = ty_le_coi của NVL i trong cối tiêu chuẩn (định mức)
                 — nếu thiếu (phiếu định mức cũ), suy tạm = khoi_luong định mức ÷ dinh_luong_coi × 100

TL ĐM(i)       = %CốiChuẩn(i) ÷ 100 × Tổng KL cối thực tế đã nhập   (cột tham chiếu, không cho sửa)

Trọng lượng thực tế(i)
               = TL ĐM(i) ngay khi vừa nhập/đổi Tổng KL cối (auto-fill toàn bộ dòng)
               = giá trị người dùng tự sửa tay, nếu họ hiệu chỉnh dòng đó sau đó

% thực tế(i)   = Trọng lượng thực tế(i) × 100 ÷ Σ Trọng lượng thực tế mọi dòng NVL trong cối đó
                 — tính lại mỗi khi bất kỳ dòng nào trong cối thay đổi (kể cả do auto-fill lẫn sửa tay)
```

Đổi lại "Tổng KL cối thực tế" sau khi đã có dòng bị sửa tay khác TL ĐM sẽ hỏi xác nhận trước khi ghi đè.

Bảng mỗi cối gồm 5 cột: **Mã NVL, Tên NVL, TL ĐM, Trọng lượng thực tế, % thực tế**.

## Giới hạn tổng khối lượng

Với mỗi SP-block: `Σ Tổng KL cối thực tế (mọi lần trộn đã thêm)` không được vượt `Tổng SL sau hao hụt` (`tong_trong_luong`) của SP đó — hiển thị "Đã trộn: X / Y kg" realtime, chặn khi bấm **Lưu đúng dòng này** nếu vượt.

## Dữ liệu lưu xuống (schema không đổi)

`chi_tiet` vẫn theo đúng shape cũ — `nvl` cấp sản phẩm giữ cối đầu để tương thích dữ liệu cũ, `lan_tron` là mảng có độ dài **tuỳ người dùng quyết định** (không còn ràng buộc khớp `so_lan_tron` của định mức). BE (`/api/phieu-tron-thuc-te`) không validate số lượng `lan_tron`, chỉ validate định dạng `trong_luong_thuc_te` (số không âm, tối đa 2 chữ số thập phân).

**Dữ liệu cũ:** `lan_tron[].tong_trong_luong` của các phiếu lưu trước đây mang nghĩa *khối lượng định mức* của lần trộn đó (copy từ định mức lúc tạo), không phải số đã cân thực tế — nên khi load lại, "Tổng KL cối thực tế" hiển thị **luôn được suy ra lại** = tổng `trong_luong_thuc_te` các dòng NVL đã lưu trong cối đó (không đọc trực tiếp field `tong_trong_luong` cũ). Số cối hiển thị = đúng số `lan_tron` đã lưu, không tự thêm/bớt.

**Load sau F5:** cối tiêu chuẩn luôn lấy lại từ định mức hiện hành; cối thực tế gắn từ phiếu đã lưu (khớp theo `ma_sp`); nhớ Ngày/Ca/phiếu trong `sessionStorage`.

## In phiếu

Giữ nguyên format hiện tại (`MixingNormRatioPrintSheet.tsx`, `isActual: true`) — cột "Lần trộn" vẫn hiển thị TL ĐM (định mức quy theo Tổng KL cối thực tế của từng lần), cột "Lần trộn thực tế" vẫn lấy đúng số nhân sự đã nhập/sửa.
