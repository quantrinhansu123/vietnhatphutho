/** Chi phí kèm theo từng dòng. Thành tiền nhập tay, không nhân với số lượng. */

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
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyChiPhiKemTheo(): ChiPhiKemTheoDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ten: '',
    donGia: '',
    thanhTien: ''
  };
}

export function sumKemDraft(items: ChiPhiKemTheoDraft[] | undefined) {
  return roundKem(
    (items || []).reduce((sum, item) => {
      const amount = moneyOf(item.thanhTien);
      return sum + (amount > 0 ? amount : 0);
    }, 0)
  );
}

export function kemDraftFromStored(raw: unknown): ChiPhiKemTheoDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const donGia = moneyOf(row.don_gia ?? row.donGia);
    const thanhTien = moneyOf(row.thanh_tien ?? row.thanhTien);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ten: String(row.ten ?? row.name ?? '').trim().slice(0, 120),
      donGia: donGia ? String(donGia) : '',
      thanhTien: thanhTien ? String(thanhTien) : ''
    };
  });
}

export function kemStoredFromDraft(items: ChiPhiKemTheoDraft[] | undefined): ChiPhiKemTheoStored[] {
  return (items || [])
    .filter(item => item.ten.trim() || item.donGia.trim() || item.thanhTien.trim())
    .map(item => ({
      ten: item.ten.trim().slice(0, 120),
      don_gia: roundKem(Math.max(0, moneyOf(item.donGia))),
      thanh_tien: roundKem(Math.max(0, moneyOf(item.thanhTien)))
    }));
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
  const filled = (items || []).filter(item => item.ten.trim() || item.donGia.trim() || item.thanhTien.trim());
  if (filled.length > 50) return `${lineLabel}: tối đa 50 khoản chi phí kèm theo.`;
  for (let index = 0; index < filled.length; index += 1) {
    const item = filled[index];
    const label = `${lineLabel}, khoản ${index + 1}`;
    if (!item.ten.trim()) return `${label}: thiếu tên chi phí.`;
    if (item.ten.trim().length > 120) return `${label}: tên chi phí tối đa 120 ký tự.`;
    const donGia = moneyOf(item.donGia);
    const thanhTien = moneyOf(item.thanhTien);
    if (item.donGia.trim() && (!Number.isFinite(donGia) || donGia < 0)) return `${label}: đơn giá phải lớn hơn hoặc bằng 0.`;
    if (item.thanhTien.trim() && (!Number.isFinite(thanhTien) || thanhTien < 0)) return `${label}: thành tiền phải lớn hơn hoặc bằng 0.`;
  }
  return '';
}
