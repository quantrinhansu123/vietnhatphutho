import { createRequire } from 'node:module';

// Load parse logic by evaluating server excerpt
function parseServerNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  return Number(normalized);
}

function resolveServerNplAmountType(record: Record<string, unknown>): 'phan_tram' | 'so_luong' {
  const loai = String(record.loai ?? record.amountType ?? record.dinh_luong_loai ?? '').trim().toLowerCase();
  if (loai === 'so_luong' || loai === 'quantity') return 'so_luong';
  if (loai === 'phan_tram' || loai === 'percent') return 'phan_tram';

  const quantity = parseServerNumber(record.so_luong ?? record.quantity);
  const percent = parseServerNumber(record.phan_tram ?? record.percent ?? record.ty_le);
  if (Number.isFinite(quantity) && !Number.isFinite(percent)) return 'so_luong';
  return 'phan_tram';
}

function parseProductNplPhanTramInput(raw: unknown) {
  const list = Array.isArray(raw) ? raw : null;
  if (!list) return { error: 'NPL phần trăm phải là mảng JSON.' };
  const items = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const maNpl = String(record.ma_npl ?? record.code ?? record.ma ?? '').trim();
    const loai = resolveServerNplAmountType(record);
    console.log('record', record, 'resolved loai', loai);
    if (loai === 'so_luong') {
      const quantity = parseServerNumber(record.so_luong ?? record.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) return { error: `Số lượng của ${maNpl} phải >= 0.` };
      items.push({ maNpl, quantity });
      continue;
    }
    const percent = parseServerNumber(record.phan_tram ?? record.percent ?? record.ty_le);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { error: `Phần trăm của ${maNpl} phải từ 0 đến 100.` };
    }
    items.push({ maNpl, percent });
  }
  return { items };
}

console.log(parseProductNplPhanTramInput([
  { ma_npl: 'NPL1', ten_npl: 'NVL 1', loai: 'so_luong', so_luong: 100, phan_tram: null, don_vi: 'Kg' }
]));
