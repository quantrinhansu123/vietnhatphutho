export type TongHopMode = 'nhap' | 'xuat';

export type TongHopHeader = {
  id: string;
  ma_phieu_chung: string;
  loai: TongHopMode;
  ngay: string;
  kho_dich: string;
  nguon_loai: string | null;
  nguon_id: string | null;
  dich_loai: string | null;
  dich_id: string | null;
  ca: string | null;
  loai_nhap: string | null;
  loai_xuat: string | null;
  chi_tiet: Array<Record<string, unknown>>;
  ma_phieu_nhap: string | null;
  ma_phieu_xuat: string | null;
  trang_thai: string;
  nguoi_lap: string | null;
  nguoi_giao: string | null;
  dia_diem: string | null;
  ly_do: string | null;
  ghi_chu: string | null;
};

let pendingEdit: TongHopHeader | null = null;

export function queueTongHopEdit(row: TongHopHeader) {
  pendingEdit = row;
}

export function takePendingTongHopEdit() {
  const row = pendingEdit;
  pendingEdit = null;
  return row;
}

export function formatTongHopDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function isNvlWarehouseName(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  return n.includes('nvl') || n.includes('nguyen vat lieu') || n.includes('vat tu');
}
