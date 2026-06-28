import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Thieu SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function round(value) {
  return Math.round(value * 100) / 100;
}

try {
  const { data: movements, error: movementError } = await supabase
    .from('phieu_xuat_nhap_kho')
    .select('ma_npl, loai_phieu, so_luong')
    .or('loai_kho.eq.nvl,loai_kho.is.null');

  if (movementError) throw new Error(movementError.message);

  const totals = new Map();
  for (const row of movements || []) {
    const code = String(row.ma_npl ?? '').trim();
    if (!code) continue;
    const current = totals.get(code) || { nhap: 0, xuat: 0 };
    const qty = Number(row.so_luong);
    if (!Number.isFinite(qty)) continue;
    if (String(row.loai_phieu || '').trim().toLowerCase() === 'xuat') {
      current.xuat = round(current.xuat + qty);
    } else {
      current.nhap = round(current.nhap + qty);
    }
    totals.set(code, current);
  }

  let updated = 0;
  for (const [code, value] of totals.entries()) {
    const { error } = await supabase
      .from('kho_nvl')
      .update({ nhap_trong_ky: value.nhap, xuat_trong_ky: value.xuat })
      .eq('ma_npl', code);
    if (error) {
      console.error(`${code}: ${error.message}`);
      continue;
    }
    updated += 1;
    console.log(`${code}: nhap=${value.nhap}, xuat=${value.xuat}`);
  }

  console.log(`Xong. Da cap nhat ${updated}/${totals.size} ma NPL.`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
