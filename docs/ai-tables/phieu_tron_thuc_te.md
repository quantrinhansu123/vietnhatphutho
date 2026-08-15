# phieu_tron_thuc_te

| **Bảng** | `phieu_tron_thuc_te` |
| **Tab** | `/danh-sach-bao-cao-phoi-tron` → **Phiếu trộn thực tế** |
| **SQL** | `supabase-phieu-tron-thuc-te.sql` |

**API:** `/api/phieu-tron-thuc-te`  
**UI:** `src/components/ActualMixingSheetTab.tsx`

Mỗi phiếu tham chiếu một `dinh_muc_id` của đúng `ngay` + `ca`. `chi_tiet` sao chép cấu trúc sản phẩm/`lan_tron`/NVL của phiếu định mức và bổ sung `phan_tram_thuc_te`, `trong_luong_thuc_te` theo từng cối; `nvl` cấp sản phẩm giữ cối đầu để tương thích dữ liệu cũ.

`trong_luong_thuc_te` mặc định là `0`. Người dùng nhập số không âm, tối đa 2 chữ số thập phân. Hệ thống tính tỷ trọng của từng dòng trong tổng trọng lượng thực tế các dòng NVL thuộc cùng sản phẩm:

`phan_tram_thuc_te dòng = trong_luong_thuc_te dòng × 100 / tổng trong_luong_thuc_te các dòng NVL trong cùng cối`.

`phan_tram_dinh_muc dòng = khoi_luong định mức dòng × 100 / tổng khoi_luong định mức các dòng NVL trong cùng cối`.

FE tự tính lại phần trăm ngay khi trọng lượng hợp lệ thay đổi và chặn im lặng ký tự/số sai định dạng, không tự hiển thị lỗi validation. Khi bấm `Lưu đúng dòng này`, BE validate định dạng trọng lượng; chỉ lỗi BE trả về mới được hiển thị. BE lưu dữ liệu FE gửi lên và không thực hiện phép tính phần trăm. Trigger DB chuẩn hóa trọng lượng thiếu/null trong `chi_tiet` JSONB về `0` và migration backfill dữ liệu cũ.

**Load sau F5:** form gắn trọng lượng thực tế từ phiếu đã lưu lên khung NVL định mức (merge theo `ma_sp`/`ma_nvl`) rồi tính lại `% thực tế`; nhớ Ngày/Ca/phiếu trong `sessionStorage`.
