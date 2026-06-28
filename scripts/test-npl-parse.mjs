function parseServerNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  return Number(normalized);
}

function resolveServerNplAmountType(record) {
  const loai = String(record.loai ?? record.amountType ?? record.dinh_luong_loai ?? '').trim().toLowerCase();
  if (loai === 'so_luong' || loai === 'quantity') return 'so_luong';
  if (loai === 'phan_tram' || loai === 'percent') return 'phan_tram';
  const quantity = parseServerNumber(record.so_luong ?? record.quantity);
  const percent = parseServerNumber(record.phan_tram ?? record.percent ?? record.ty_le);
  if (Number.isFinite(quantity) && !Number.isFinite(percent)) return 'so_luong';
  return 'phan_tram';
}

function parseProductNplPhanTramInput(raw) {
  const list = Array.isArray(raw) ? raw : null;
  if (!list) return { error: 'NPL phần trăm phải là mảng JSON.' };
  const items = [];
  for (const entry of list) {
    const record = entry;
    const maNpl = String(record.ma_npl ?? record.code ?? '').trim();
    const loai = resolveServerNplAmountType(record);
    if (loai === 'so_luong') {
      const quantity = Number(record.so_luong ?? record.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) return { error: `Số lượng của ${maNpl} phải >= 0.` };
    } else {
      const percent = Number(record.phan_tram ?? record.percent ?? record.ty_le);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: `Phần trăm của ${maNpl} phải từ 0 đến 100.` };
    }
  }
  return { items };
}

const tests = [
  [{ loai: 'so_luong', ma_npl: 'N1', ten_npl: 'T', so_luong: 100, phan_tram: null, don_vi: 'Kg' }],
  [{ loai: 'phan_tram', ma_npl: 'N1', ten_npl: 'T', phan_tram: 40.5, so_luong: null, don_vi: null }],
  [{ ma_npl: 'N1', ten_npl: 'T', phan_tram: '40,5' }],
  [{ loai: 'so_luong', ma_npl: 'N1', ten_npl: 'T', so_luong: '100,5', phan_tram: null }],
];

for (const t of tests) {
  console.log(JSON.stringify(t), '=>', parseProductNplPhanTramInput(t));
}
