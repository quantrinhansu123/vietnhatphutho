# bang_tron_vat_tu_dinh_muc

| **Bảng** | `bang_tron_vat_tu_dinh_muc` |
| **Tab** | `/danh-sach-bao-cao-phoi-tron` → **Phiếu trộn định mức** |
| **SQL** | `supabase-bang-tron-vat-tu-dinh-muc.sql` |

**API:** `/api/bang-tron-vat-tu-dinh-muc`  
Query: `ngay`, `ca`, `q`  
**UI:** `MixingNormMaterialsTab.tsx` · in: `MixingNormRatioPrintSheet.tsx`  
Gợi ý sang form phối trộn: `MixingReportForm.tsx` + `utils/mixingNormSuggestion.ts`

## Mô hình

**1 form nhập = 1 dòng DB = 1 phiếu**

- `ma_lenh_sx`, `ngay`, `ca`, `ghi_chu`
- Mỗi SP lưu thêm `so_luong_goc`, `ty_le_hao_hut`, `tong_trong_luong`, `dinh_luong_coi`, `so_lan_tron`.
- `tong_trong_luong = so_luong_goc × (1 - ty_le_hao_hut / 100)`; lần cuối lấy phần còn lại.
- `chi_tiet` jsonb = mảng sản phẩm:

```json
[{
  "ma_sp": "...",
  "ten_sp": "...",
  "tong_trong_luong": 1000,
  "dinh_luong_coi": 500,
  "so_lan_tron": 2,
  "nvl": [{ "ma_nvl", "ten_nvl", "ten_nvl_san_xuat", "gia_tri", "don_vi", "khoi_luong" }]
}]
```

`khoi_luong` (kg): nếu `don_vi = %` → `tong_trong_luong × gia_tri / 100`; nếu `kg` → bằng `gia_tri`.

Danh sách hiển thị **1 dòng / phiếu** (nhiều SP gộp trong phiếu). Modal lớn lặp danh sách NVL từ `san_pham.npl_phan_tram` theo từng lần trộn và cuộn ngang; lần cuối dùng phần khối lượng còn lại. In A4 ngang, tối đa 6 lần trộn mỗi bảng.
