/** Chi phí kèm theo từng dòng. Thành tiền nhập tay, không nhân với số lượng. */
import { formatMoneyVN, parseLocalizedNumber } from '../../utils';

export type ChiPhiKemTheoStored = {
  ten: string;
  don_gia: number;
  thanh_tien: number;
};

export type ChiPhiKemTheoDraft = {
  id: string;
  ten: string;
  donGia: string;
  thanhTien: string;
  /** `phieu` = gắn phiếu nhập (SL × giá); `khac` = chi phí khác. */
  loai?: 'phieu' | 'khac';
  maPhieu?: string;
  soLuong?: string;
  lotId?: string;
};

export const CHI_PHI_TEN_OPTIONS = ['Chi phí mua hàng'] as const;

export function chiPhiTenOptions(current: string) {
  const names: string[] = [...CHI_PHI_TEN_OPTIONS];
  const trimmed = current.trim().slice(0, 120);
  if (trimmed && !names.some(name => name.toLocaleLowerCase('vi') === trimmed.toLocaleLowerCase('vi'))) {
    names.push(trimmed);
  }
  return names.map(name => ({ id: name, label: name }));
}

export function roundKem(value: number) {
  return Math.round(value * 1000) / 1000;
}

function moneyOf(value: unknown) {
  const parsed = parseLocalizedNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyChiPhiKemTheo(): ChiPhiKemTheoDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ten: CHI_PHI_TEN_OPTIONS[0],
    donGia: '',
    thanhTien: '',
    loai: 'khac'
  };
}

export function emptyChiPhiTheoPhieu(): ChiPhiKemTheoDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ten: '',
    donGia: '',
    thanhTien: '',
    loai: 'phieu',
    maPhieu: '',
    soLuong: '',
    lotId: ''
  };
}

export function chiPhiLineAmount(item: ChiPhiKemTheoDraft) {
  if (item.loai === 'phieu') {
    const qty = moneyOf(item.soLuong);
    const price = moneyOf(item.donGia);
    if (qty > 0 && price > 0) return roundKem(qty * price);
  }
  const amount = moneyOf(item.thanhTien.trim() || item.donGia);
  return amount > 0 ? roundKem(amount) : 0;
}

export function sumKemDraft(items: ChiPhiKemTheoDraft[] | undefined) {
  return roundKem((items || []).reduce((sum, item) => sum + chiPhiLineAmount(item), 0));
}

export function kemDraftFromStored(raw: unknown): ChiPhiKemTheoDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const donGia = moneyOf(row.don_gia ?? row.donGia);
    const thanhTien = moneyOf(row.thanh_tien ?? row.thanhTien);
    const ten = String(row.ten ?? row.name ?? '').trim().slice(0, 120);
    const maPhieu = String(row.ma_phieu ?? row.maPhieu ?? '').trim();
    const soLuong = moneyOf(row.so_luong ?? row.soLuong);
    const isPhieu = Boolean(maPhieu) || /^theo phiếu\b/i.test(ten);
    const parsedMa = maPhieu || (ten.match(/theo phiếu\s+([^\s·]+)/i)?.[1] || '');
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ten,
      donGia: donGia ? formatMoneyVN(donGia, 0) : '',
      thanhTien: thanhTien ? formatMoneyVN(thanhTien, 0) : '',
      loai: isPhieu ? 'phieu' : 'khac',
      maPhieu: parsedMa,
      soLuong: soLuong > 0 ? String(soLuong) : '',
      lotId: String(row.lot_id ?? row.lotId ?? '').trim()
    };
  });
}

export function kemStoredFromDraft(items: ChiPhiKemTheoDraft[] | undefined): ChiPhiKemTheoStored[] {
  return (items || [])
    .filter(item => {
      if (item.loai === 'phieu') {
        return Boolean(item.maPhieu?.trim() || item.ten.trim()) && chiPhiLineAmount(item) > 0;
      }
      return Boolean(item.ten.trim() || item.donGia.trim() || item.thanhTien.trim());
    })
    .map(item => {
      const amount = chiPhiLineAmount(item);
      const donGia = roundKem(Math.max(0, moneyOf(item.donGia.trim() || item.thanhTien)));
      const maPhieu = String(item.maPhieu || '').trim();
      const ten =
        item.loai === 'phieu'
          ? (item.ten.trim() || `Theo phiếu ${maPhieu || '—'}`).slice(0, 120)
          : item.ten.trim().slice(0, 120);
      return {
        ten,
        don_gia: donGia || amount,
        thanh_tien: amount || donGia
      };
    });
}

export function sumKemStored(raw: unknown) {
  if (!Array.isArray(raw)) return 0;
  return roundKem(
    raw.reduce((sum, item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const amount = moneyOf(row.thanh_tien ?? row.thanhTien);
      return sum + (amount > 0 ? amount : 0);
    }, 0)
  );
}

export function kemDraftError(lineLabel: string, items: ChiPhiKemTheoDraft[] | undefined) {
  const filled = (items || []).filter(item => {
    if (item.loai === 'phieu') return Boolean(item.maPhieu?.trim() || item.soLuong?.trim() || item.donGia.trim() || item.ten.trim());
    return Boolean(item.ten.trim() || item.donGia.trim() || item.thanhTien.trim());
  });
  if (filled.length > 50) return `${lineLabel}: tối đa 50 khoản chi phí kèm theo.`;
  for (let index = 0; index < filled.length; index += 1) {
    const item = filled[index];
    const label = `${lineLabel}, khoản ${index + 1}`;
    if (item.loai === 'phieu') {
      if (!String(item.maPhieu || '').trim()) return `${label}: thiếu phiếu nhập.`;
      const qty = moneyOf(item.soLuong);
      const price = moneyOf(item.donGia);
      if (!Number.isFinite(qty) || qty <= 0) return `${label}: số lượng phải lớn hơn 0.`;
      if (!Number.isFinite(price) || price <= 0) return `${label}: giá theo phiếu phải lớn hơn 0.`;
      continue;
    }
    if (!item.ten.trim()) return `${label}: thiếu tên chi phí.`;
    if (item.ten.trim().length > 120) return `${label}: tên chi phí tối đa 120 ký tự.`;
    const thanhTienRaw = item.thanhTien.trim() || item.donGia.trim();
    const thanhTien = moneyOf(thanhTienRaw);
    if (!thanhTienRaw) return `${label}: thiếu giá tiền.`;
    if (!Number.isFinite(thanhTien) || thanhTien <= 0) return `${label}: giá tiền phải lớn hơn 0.`;
  }
  return '';
}
