export interface BaoCaoThangDotSummary {
  id: string;
  ten_dot: string;
  dot_so: number;
  tu_ngay: string;
  den_ngay: string;
  ma_may: string;
  ten_may: string;
  tl_chinh: number;
  tien_chinh: number;
  tl_phu: number;
  tien_phu: number;
  thu_hoi_tl: number;
  thu_hoi_tien: number;
  hao_hut_kg: number;
  tl_thuc_te: number;
  so_cong: number;
  tong_chi_phi_nhan_cong: number;
  don_gia_tong: number;
  bq_vt_nhan_cong: number;
}

export interface BaoCaoThangRow {
  id: string;
  ten_bao_cao: string;
  thang: number;
  nam: number;
  ma_may: string;
  ten_may: string;
  dot_ids: string[];
  dot_snapshot: BaoCaoThangDotSummary[];
  so_dot: number;
  tong_tl_nvl_chinh: number;
  tong_tien_nvl_chinh: number;
  tong_tl_nvl_phu: number;
  tong_tien_nvl_phu: number;
  thu_hoi_phe_tl: number;
  thu_hoi_phe_tien: number;
  hao_hut_kg: number;
  tl_chinh_thuc_te: number;
  gia_vt_tt_hao_hut?: number | null;
  chenh_lech_hao_hut?: number | null;
  ti_le_hao_hut?: number | null;
  so_cong_truc: number;
  so_cong_dau_may: number;
  so_cong_cuoi_may: number;
  tong_chi_phi_nhan_cong: number;
  ghi_chu: string;
  nguoi_lap: string;
  created_at?: string;
  updated_at?: string;
}

export interface BaoCaoThangAggregateResponse {
  thang: number;
  nam: number;
  ma_may: string;
  ten_may: string;
  so_dot: number;
  dot_ids: string[];
  dot_snapshot: BaoCaoThangDotSummary[];
  tong: {
    tong_tl_nvl_chinh: number;
    tong_tien_nvl_chinh: number;
    tong_tl_nvl_phu: number;
    tong_tien_nvl_phu: number;
    thu_hoi_phe_tl: number;
    thu_hoi_phe_tien: number;
    hao_hut_kg: number;
    tl_chinh_thuc_te: number;
    so_cong_truc: number;
    so_cong_dau_may: number;
    so_cong_cuoi_may: number;
    tong_chi_phi_nhan_cong: number;
  };
  thang_truoc: {
    ten: string;
    don_gia_chinh: number;
    don_gia_phu: number;
    don_gia_chinh_thuc_te: number;
    don_gia_tong: number;
    don_gia_nhan_cong: number;
  } | null;
}

export interface BaoCaoThangPrintData {
  ten_bao_cao: string;
  thang: number;
  nam: number;
  ma_may: string;
  ten_may: string;
  dot_snapshot: BaoCaoThangDotSummary[];
  so_dot: number;
  tong_tl_nvl_chinh: number;
  tong_tien_nvl_chinh: number;
  tong_tl_nvl_phu: number;
  tong_tien_nvl_phu: number;
  thu_hoi_phe_tl: number;
  thu_hoi_phe_tien: number;
  hao_hut_kg: number;
  tl_chinh_thuc_te: number;
  gia_vt_tt_hao_hut?: number | null;
  chenh_lech_hao_hut?: number | null;
  ti_le_hao_hut?: number | null;
  so_cong_truc: number;
  so_cong_dau_may: number;
  so_cong_cuoi_may: number;
  tong_chi_phi_nhan_cong: number;
  ghi_chu: string;
  nguoi_lap?: string;
  prev_ten?: string;
  prev_don_gia_chinh?: number;
  prev_don_gia_phu?: number;
  prev_don_gia_chinh_thuc_te?: number;
  prev_don_gia_tong?: number;
  prev_don_gia_nhan_cong?: number;
}
