# Bản đồ code theo bảng Supabase

**Mục đích:** AI chỉ đọc file bảng liên quan — không cần mở `App.monolith.backup.tsx` hay toàn bộ `server.ts`.

## Cách dùng

1. Xác định bảng Supabase (hoặc tab/route).
2. Mở **`docs/ai-tables/<ten-bang>.md`** tương ứng (~20 dòng).
3. Chỉ đọc các file được liệt kê — **ưu tiên `src/features/<bang>/`**, không mở `App.monolith.backup.tsx`.
4. Tra cứu nhanh: `src/features/registry.ts`.

### Vì sao ít token hơn nhiều

- Monolith: `App.tsx` backup ~18k dòng → AI dễ đọc quá tay.
- Manifest + feature: ~20 dòng manifest + 1 file feature ~500–1.100 dòng + vài component + ~100 dòng API.

Khi tách feature mới: cập nhật manifest (`appLines` → `src/features/...`) và `registry.ts` ngay.

## Danh sách bảng

| Bảng | Tab / Route | Manifest |
|------|-------------|----------|
| `reports` | `/nhap-bao-cao` | [reports.md](./reports.md) |
| `phieu_can_dinh_ki` | `/tong-hop-ca` | [phieu_can_dinh_ki.md](./phieu_can_dinh_ki.md) |
| `can_tu_dong` | `/can-tu-dong` | [can_tu_dong.md](./can_tu_dong.md) |
| `kiem_kho` | `/kiem-kho` | [kiem_kho.md](./kiem_kho.md) |
| `quan_ly_kho` | `/quan-ly-kho` | [quan_ly_kho.md](./quan_ly_kho.md) |
| `bao_cao_hang_hong` | `/bao-cao-hang-hong` | [bao_cao_hang_hong.md](./bao_cao_hang_hong.md) |
| `san_pham` | `/san-pham` | [san_pham.md](./san_pham.md) |
| `danh_sach_may` | `/danh-sach-may` | [danh_sach_may.md](./danh_sach_may.md) |
| `kho_nvl` | `/kho-nvl` | [kho_nvl.md](./kho_nvl.md) |
| `phieu_xuat_nhap_kho` | `/phieu-xuat-nhap-kho` (facade cũ) | [phieu_xuat_nhap_kho.md](./phieu_xuat_nhap_kho.md) |
| `phieu_nhap_kho` | `/phieu-xuat-nhap-kho` (lọc nhập) | [phieu_nhap_kho.md](./phieu_nhap_kho.md) |
| `phieu_xuat_kho` | `/phieu-xuat-nhap-kho` (lọc xuất) | [phieu_xuat_kho.md](./phieu_xuat_kho.md) |
| `don_hang` | `/don-hang` | [don_hang.md](./don_hang.md) |
| `khach_hang` | `/khach-hang` | [khach_hang.md](./khach_hang.md) |
| `nha_cung_cap` | `/nha-cung-cap` | [nha_cung_cap.md](./nha_cung_cap.md) |
| `lenh_xuat_hang` | `/lenh-xuat-hang` | [lenh_xuat_hang.md](./lenh_xuat_hang.md) |
| `lenh_sx` | `/lenh-san-xuat` | [lenh_sx.md](./lenh_sx.md) |
| `ke_hoach_san_xuat` | `/ke-hoach-san-xuat` | [ke_hoach_san_xuat.md](./ke_hoach_san_xuat.md) |
| `dot_san_xuat` | `/dot-san-xuat` | [dot_san_xuat.md](./dot_san_xuat.md) |
| `nhan_su` | `/nhan-su` | [nhan_su.md](./nhan_su.md) |
| `chi_phi_nhan_cong` | `/chi-phi-nhan-cong` | [chi_phi_nhan_cong.md](./chi_phi_nhan_cong.md) |
| `chi_phi_dien` | `/chi-phi-dien` (card **Chi phí điện** trong `/hcns`) | [chi_phi_dien.md](./chi_phi_dien.md) |
| `chi_phi_bao_duong` | `/chi-phi-bao-duong` (card **Chi phí bảo dưỡng** trong QC `/nha-may/qc`) | [chi_phi_bao_duong.md](./chi_phi_bao_duong.md) |
| `danh_sach_xe` | `/danh-sach-xe` | [danh_sach_xe.md](./danh_sach_xe.md) |
| `doi_chieu_lai_xe` | `/danh-sach-xe` | [danh_sach_xe.md](./danh_sach_xe.md) |
| `chi_phi_xe` | `/danh-sach-xe` | [chi_phi_xe.md](./chi_phi_xe.md) |
| `nhat_ky_xe` | `/danh-sach-xe` | [nhat_ky_xe.md](./nhat_ky_xe.md) |
| `tuyen_giao_hang_xe` | `/danh-sach-xe` | [danh_sach_xe.md](./danh_sach_xe.md) |
| `thu_tien_khach_hang` | `/danh-sach-xe` | [thu_tien_khach_hang.md](./thu_tien_khach_hang.md) |
| `cai_dat_thoi_gian` | `/cai-dat` | [cai_dat_thoi_gian.md](./cai_dat_thoi_gian.md) |
| `bao_cao_phoi_tron` | `/bao-cao-phoi-tron` | [bao_cao_phoi_tron.md](./bao_cao_phoi_tron.md) |
| `bang_tron_vat_tu_dinh_muc` | `/danh-sach-bao-cao-phoi-tron` (tab định mức) | [bang_tron_vat_tu_dinh_muc.md](./bang_tron_vat_tu_dinh_muc.md) |
| `phieu_tron_thuc_te` | `/danh-sach-bao-cao-phoi-tron` (tab thực tế) | [phieu_tron_thuc_te.md](./phieu_tron_thuc_te.md) |
| `bao_cao_nghiem_thu` | `/bao-cao-san-luong` | [bao_cao_nghiem_thu.md](./bao_cao_nghiem_thu.md) |
| `bao_cao_may_nvl_ton` | `/bao-cao-may-nvl-ton` | [bao_cao_may_nvl_ton.md](./bao_cao_may_nvl_ton.md) |
| `so_tron` | `/so-tron` (card Sổ trộn trong `/bao-cao-truong-ca-tron`, vào từ `/nha-may/cong-nhan`) | [so_tron.md](./so_tron.md) |
| `nhap_kho` | `/kho-hang` → Kho thành phẩm (danh sách SP + tồn kỳ) | [nhap_kho.md](./nhap_kho.md) |
| `ton_kho_thanh_pham` | *(không dùng UI — xem nhap_kho)* | [ton_kho_thanh_pham.md](./ton_kho_thanh_pham.md) |
| `bao_cao_ngay` | `/bao-cao-ngay` (card Báo cáo ngày trong `/phieu-bao-cao`) + `/danh-sach-bao-cao-ngay` | [bao_cao_ngay.md](./bao_cao_ngay.md) |
| `so_giao_ca_mmtb` | `/so-giao-ca-mmtb` (card Sổ giao ca MMTB trong `/bao-cao-truong-ca-tron`) | [so_giao_ca_mmtb.md](./so_giao_ca_mmtb.md) |
| `so_test_mau_nhua` | `/so-test-mau-nhua` (card Sổ test mẫu nhựa trong QC `/nha-may/qc`) | [so_test_mau_nhua.md](./so_test_mau_nhua.md) |
| `bao_cao_hang_loi_khach_hang` | `/bao-cao-hang-loi-khach-hang` (card Báo cáo hàng lỗi hỏng trong `/kinh-doanh`) + `/thong-ke-hang-loi-khach-hang` (card Thống kê hàng lỗi hỏng trong QC `/nha-may/qc`) | [bao_cao_hang_loi_khach_hang.md](./bao_cao_hang_loi_khach_hang.md) |
| `so_che_do_may` | `/so-che-do-may` (card Sổ chế độ máy trong `/bao-cao-truong-ca-tron`) + `/danh-sach-so-che-do-may` | [so_che_do_may.md](./so_che_do_may.md) |
| `phieu_bao_dung_may` | `/phieu-bao-dung-may` | [phieu_bao_dung_may.md](./phieu_bao_dung_may.md) |
| *(chưa có bảng)* | `/bao-cao-tuan` (card Báo cáo tuần trong `/phieu-bao-cao`) | [bao_cao_tuan.md](./bao_cao_tuan.md) |
| `bao_cao_thang` | `/bao-cao-thang` (card Báo cáo tháng trong `/phieu-bao-cao`) + `/danh-sach-bao-cao-thang` | [bao_cao_thang.md](./bao_cao_thang.md) |
| `lenh_cat_le` | `/lenh-cat-le` (card **Lệnh cắt lẻ** trong `/nha-may/kho`) | [lenh_cat_le.md](./lenh_cat_le.md) |
| `phieu_chuyen_kho` | `/chuyen-kho` (card **Chuyển kho** trong `/nha-may/kho`) | [phieu_chuyen_kho.md](./phieu_chuyen_kho.md) |
| `phieu_nhap_xuat_tong_hop` | `/phieu-nhap-xuat-tong-hop` và `/danh-sach-phieu-nhap-xuat-tong-hop` | [xuat_nhap_tong_hop.md](./xuat_nhap_tong_hop.md) |
| *(tổng hợp)* | `/bang-dieu-khien` | [control_board.md](./control_board.md) |

## File dùng chung (chỉ khi cần)

| File | Khi nào đọc |
|------|-------------|
| `src/routes.ts` | Đổi tab, URL, điều hướng |
| `src/types.ts` | Kiểu báo cáo sản xuất ca |
| `src/utils.ts` | Format số, tiền, parse input |
| `src/App.tsx` (~1.3k dòng) | Shell layout, menu, routing — logic từng bảng ở `src/features/` |
| `server.ts` (đầu file) | Supabase client, hằng số bảng — **dòng 1–120** |
