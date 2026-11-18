/**
 * Seed tồn kho NVL:
 * - ĐVT kg → 5000
 * - ĐVT khác → 500
 *
 * 1) Cập nhật ton_dau_ky trên kho_nvl
 * 2) Tạo phiếu nhập (ngày cuối tháng trước) để tồn kỳ /kho-hang nhận đúng số
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const API = process.env.SEED_API_BASE || 'http://127.0.0.1:3001';

if (!url || !key) {
  console.error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const REASON = 'Seed tồn kho 500/5000';
const CHUNK = 80;

function fold(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '');
}

function isKg(donVi) {
  const u = fold(donVi);
  return u === 'kg' || u === 'kilogram' || u === 'kilogramme' || u.startsWith('kg/');
}

function qtyForUnit(donVi) {
  return isKg(donVi) ? 5000 : 500;
}

/** Ngày phiếu = ngày cuối tháng trước (để vào cột Tồn đầu của tháng hiện tại). */
function openingSlipDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchAllMaterials() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from('kho_nvl')
      .select('id, ma_npl, ten_npl, ten_nvl_sx, don_vi, ten_kho, loai_kho, ton_dau_ky')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`kho_nvl: ${error.message}`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function updateTonDauKy(rows) {
  let kg = 0;
  let other = 0;
  let failed = 0;
  for (const row of rows) {
    const qty = qtyForUnit(row.don_vi);
    if (qty === 5000) kg++;
    else other++;
    const { error } = await supabase.from('kho_nvl').update({ ton_dau_ky: qty }).eq('id', row.id);
    if (error) {
      failed++;
      console.warn(`update ${row.id} ${row.ma_npl}: ${error.message}`);
    }
  }
  return { kg, other, failed, total: rows.length };
}

async function postInboundSlip(warehouse, ngayPhieu, items) {
  const res = await fetch(`${API}/api/phieu-nhap-kho`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loaiPhieu: 'nhap',
      loaiKho: 'nvl',
      ngayPhieu,
      tenKho: warehouse,
      lyDo: REASON,
      ghiChu: 'Seed tồn: kg=5000, ĐVT khác=500',
      loaiNhapKho: 'Seed tồn kho',
      items
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status} khi tạo phiếu ${warehouse}`);
  }
  return String(data.slipCode || data.ma_phieu || '').trim();
}

async function createInboundSlips(rows, ngayPhieu) {
  const byWh = new Map();
  let skippedNoWh = 0;
  let skippedNoCode = 0;
  for (const row of rows) {
    const code = String(row.ma_npl || '').trim();
    const warehouse = String(row.ten_kho || '').trim();
    if (!code) {
      skippedNoCode++;
      continue;
    }
    if (!warehouse) {
      skippedNoWh++;
      continue;
    }
    const list = byWh.get(warehouse) || [];
    list.push({
      ma_npl: code,
      ten_npl: String(row.ten_npl || code).trim(),
      ...(row.ten_nvl_sx ? { ten_nvl_sx: String(row.ten_nvl_sx).trim() } : {}),
      don_vi: String(row.don_vi || '').trim(),
      so_luong: qtyForUnit(row.don_vi),
      material_id: row.id
    });
    byWh.set(warehouse, list);
  }

  const slipCodes = [];
  for (const [warehouse, items] of byWh) {
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const code = await postInboundSlip(warehouse, ngayPhieu, chunk);
      if (code) slipCodes.push(code);
      console.log(`  ${warehouse}: phiếu ${code || '?'} — ${chunk.length} dòng`);
    }
  }
  return { slipCodes, warehouses: byWh.size, skippedNoWh, skippedNoCode };
}

async function main() {
  // ping API
  try {
    const ping = await fetch(`${API}/api/kho-nvl?limit=1`);
    if (!ping.ok) throw new Error(`API ${ping.status}`);
  } catch (e) {
    console.error(`Không kết nối được ${API}. Hãy chạy server trước (npx tsx server.ts).`);
    console.error(String(e.message || e));
    process.exit(1);
  }

  const rows = await fetchAllMaterials();
  console.log(`Danh mục kho_nvl: ${rows.length} dòng`);

  const units = new Map();
  for (const r of rows) {
    const u = String(r.don_vi || '(trống)').trim() || '(trống)';
    units.set(u, (units.get(u) || 0) + 1);
  }
  console.log(
    'ĐVT:',
    [...units.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([u, n]) => `${u}=${n}`)
      .join(', ')
  );

  console.log('1) Cập nhật ton_dau_ky...');
  const upd = await updateTonDauKy(rows);
  console.log(upd);

  const ngayPhieu = openingSlipDate();
  console.log(`2) Tạo phiếu nhập ngày ${ngayPhieu}...`);
  const slips = await createInboundSlips(rows, ngayPhieu);
  console.log(
    JSON.stringify(
      {
        ngayPhieu,
        reason: REASON,
        warehouses: slips.warehouses,
        slipCodes: slips.slipCodes,
        skippedNoWh: slips.skippedNoWh,
        skippedNoCode: slips.skippedNoCode
      },
      null,
      2
    )
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
