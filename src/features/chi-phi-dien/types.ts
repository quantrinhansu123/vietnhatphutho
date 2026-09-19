/** Chi phí tiền điện theo tháng và loại/nhóm máy (màn HCNS → Chi phí điện). */
export interface ChiPhiDienRow {
  /** Loại/Nhóm máy (danh_sach_may.loai_may/nhom_may): Rỗng, Sóng, Đặc, Nẹp... */
  loai_may: string;
  /** Tiền điện trong tháng (đ) — người dùng nhập. */
  tien_dien: number;
  /** Thành phẩm trong tháng (kg) — tự tổng hợp từ sổ trộn, cho phép sửa tay. */
  thanh_pham: number;
  /** Đồng/Kg = tien_dien / thanh_pham (làm tròn đồng). */
  dong_kg: number;
  /** Diễn giải hiển thị trong ngoặc ở dòng đỏ, vd "trong tháng thay khuôn 2 lần". */
  ghi_chu: string;
}

export interface ChiPhiDienDetail {
  /** Định giá theo năm: ky = 'nam', thang = 0. */
  ky?: string;
  thang: number;
  nam: number;
  rows: ChiPhiDienRow[];
  tong_tien_dien: number;
  tong_thanh_pham: number;
  tb_dong_kg: number;
  /** Năm so sánh (năm gần nhất có bản ghi, null nếu chưa có). */
  prev_thang: number | null;
  prev_nam: number | null;
  /** Đồng/Kg từng loại ở năm so sánh: loai_may -> dong_kg. */
  prev_dong_kg: Record<string, number>;
}

export interface ChiPhiDienRecord {
  id: string;
  thang: number;
  nam: number;
  ten_bao_cao: string;
  loai_may_list: string[];
  tong_tien_dien: number;
  tong_thanh_pham: number;
  tb_dong_kg: number;
  chi_tiet: ChiPhiDienDetail;
  ghi_chu: string;
  nguoi_lap: string;
  created_at?: string;
  updated_at?: string;
}
