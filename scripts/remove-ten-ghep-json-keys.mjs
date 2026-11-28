import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function removeTenGhep(value) {
  if (Array.isArray(value)) return value.map(removeTenGhep);
  if (!value || typeof value !== 'object') return value;
  const rawName = String(value.ten_ghep ?? value.tenGhep ?? '').trim();
  const result = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'ten_ghep' && key !== 'tenGhep')
      .map(([key, child]) => [key, removeTenGhep(child)])
  );
  if (rawName && !String(result.ten_san_xuat ?? result.tenSanXuat ?? result.productionName ?? '').trim()) {
    result.ten_san_xuat = rawName;
  }
  return result;
}

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

async function run() {
  dotenv.config({ quiet: true });
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error('Thiếu cấu hình Supabase trong .env.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const apply = process.argv.includes('--apply');
  const folder = path.resolve('outputs', `remove-ten-ghep-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(folder, { recursive: true });

  const targets = [
    { table: process.env.SUPABASE_ORDERS_TABLE || 'don_hang', column: 'san_pham', code: row => row.ma_don_hang },
    { table: process.env.SUPABASE_PRODUCTION_ORDERS_TABLE || 'lenh_sx', column: 'san_pham', code: row => row.ma_lenh_sx },
    { table: process.env.SUPABASE_MIXING_NORM_TABLE || 'bang_tron_vat_tu_dinh_muc', column: 'chi_tiet', code: row => row.ten_phieu || row.ma_lenh_sx },
    { table: process.env.SUPABASE_ACTUAL_MIXING_SHEET_TABLE || 'phieu_tron_thuc_te', column: 'chi_tiet', code: row => row.ma_lenh_sx || row.dinh_muc_id }
  ];
  const plans = [];
  for (const target of targets) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(target.table).select('*').order('id').range(offset, offset + 499);
      if (error) throw new Error(`${target.table}: ${error.message}`);
      rows.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const backedUp = rows.map(row => ({ id: row.id, updated_at: row.updated_at, value: row[target.column] }));
    await writeFile(path.join(folder, `${target.table}-${target.column}-before.json`), JSON.stringify(backedUp, null, 2));
    for (const row of rows) {
      let value = row[target.column];
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { continue; }
      }
      const nextValue = removeTenGhep(value);
      if (!same(nextValue, value)) plans.push({ ...target, row, before: row[target.column], next: typeof row[target.column] === 'string' ? JSON.stringify(nextValue) : nextValue });
    }
    console.log(`${target.table}.${target.column}: scanned ${rows.length} records`);
  }
  const report = plans.map(({ table, column, row, code }) => ({ table, column, id: row.id, code: code(row) || '' }));
  await writeFile(path.join(folder, 'plan.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changedRecords: plans.length, backup: folder, records: report }));
  if (!apply) return;

  const applied = [];
  for (const plan of plans) {
    let query = db.from(plan.table).update({ [plan.column]: plan.next }).eq('id', plan.row.id);
    if (plan.row.updated_at) query = query.eq('updated_at', plan.row.updated_at);
    const { data, error } = await query.select(`id,${plan.column}`).single();
    if (error || !data || !same(data[plan.column], plan.next)) {
      throw new Error(`${plan.table}/${plan.row.id}: ${error?.message || 'không xác minh được dữ liệu sau cập nhật'}`);
    }
    applied.push({ table: plan.table, id: plan.row.id });
    await writeFile(path.join(folder, 'applied.json'), JSON.stringify(applied, null, 2));
  }
  console.log(`Verified ${applied.length} updated records`);
}

run().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
