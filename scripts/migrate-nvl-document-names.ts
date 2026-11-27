/** Dry-run first. --apply requires an entirely resolved plan and writes a durable backup first. */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanNvlDocument, type NvlCatalogRef, type NvlDocumentKind } from '../src/utils/nvlDocument';

dotenv.config({ quiet: true });
const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { persistSession: false } });
const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
function numericLeaves(value: unknown, prefix = ''): Record<string, number> {
  if (typeof value === 'number') return { [prefix]: value };
  if (!value || typeof value !== 'object') return {};
  return Object.assign({}, ...Object.entries(value).map(([k, v]) => numericLeaves(v, `${prefix}/${k}`)));
}
async function all(table: string) {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from(table).select('*').order('id').range(offset, offset + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data); if (data.length < 500) return rows;
  }
}
type Change = { table: string; id: string; before: Record<string, unknown>; after: Record<string, unknown>; updated_at?: string };
async function main() {
  const restoreIndex = process.argv.indexOf('--restore');
  if (restoreIndex >= 0) {
    const dir = path.resolve(process.argv[restoreIndex + 1] || '');
    const changes: Change[] = JSON.parse(await readFile(path.join(dir, 'changes.json'), 'utf8'));
    const applied: string[] = JSON.parse(await readFile(path.join(dir, 'applied.json'), 'utf8'));
    for (const c of [...changes].reverse().filter(c => applied.includes(`${c.table}/${c.id}`))) {
      const { data, error } = await db.from(c.table).select('*').eq('id', c.id).single();
      if (error || !Object.keys(c.after).every(k => same(data?.[k], c.after[k]))) throw new Error(`Không khôi phục ${c.table}/${c.id}: dữ liệu đã đổi sau migration.`);
      const { error: writeError } = await db.from(c.table).update(c.before).eq('id', c.id);
      if (writeError) throw writeError;
    }
    console.log('Đã khôi phục các trường thay đổi từ bản sao lưu.'); return;
  }
  const apply = process.argv.includes('--apply');
  const dir = path.resolve('outputs', `nvl-document-names-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(dir, { recursive: true });
  const catalog = await all(process.env.SUPABASE_MATERIALS_TABLE || 'kho_nvl') as NvlCatalogRef[];
  const targets: Array<[string, NvlDocumentKind]> = [
    [process.env.SUPABASE_MIXING_NORM_TABLE || 'bang_tron_vat_tu_dinh_muc', 'mixing'],
    [process.env.SUPABASE_ACTUAL_MIXING_SHEET_TABLE || 'phieu_tron_thuc_te', 'mixing'],
    [process.env.SUPABASE_SO_TRON_TABLE || 'so_tron', 'mixing'],
    ['phieu_nhap_xuat_tong_hop', 'warehouse'],
    [process.env.SUPABASE_WAREHOUSE_NHAP_TABLE || 'phieu_nhap_kho', 'movement'],
    [process.env.SUPABASE_WAREHOUSE_XUAT_TABLE || 'phieu_xuat_kho', 'movement'],
    [process.env.SUPABASE_WAREHOUSE_MOVEMENTS_TABLE || 'phieu_xuat_nhap_kho', 'movement'],
    [process.env.SUPABASE_WAREHOUSE_HISTORY_TABLE || 'phieu_xuat_nhap_kho_lich_su', 'history']
  ];
  const changes: Change[] = []; const unresolved: unknown[] = []; const summary: unknown[] = [];
  const inbound = await all(process.env.SUPABASE_WAREHOUSE_NHAP_TABLE || 'phieu_nhap_kho');
  const outbound = await all(process.env.SUPABASE_WAREHOUSE_XUAT_TABLE || 'phieu_xuat_kho');
  for (const [table, kind] of targets) {
    const rows = await all(table);
    await writeFile(path.join(dir, `${table}.before.json`), JSON.stringify(rows, null, 2));
    let changed = 0;
    for (const row of rows) {
      try {
        let source = row;
        if (kind === 'warehouse' && Array.isArray(row.chi_tiet)) {
          const codes = String(row.ma_phieu_xuat || row.ma_phieu_nhap || '').split(',').map(s => s.trim());
          const legs = (row.ma_phieu_xuat ? outbound : inbound).filter(leg => codes.includes(String(leg.ma_phieu)) && leg.loai_danh_muc === 'kho_nvl');
          source = { ...row, chi_tiet: row.chi_tiet.map((line: any) => {
            if (line.material_id || line.loai_danh_muc === 'san_pham') return line;
            const hits = legs.filter(leg => String(leg.ma_npl || '').trim().toLowerCase() === String(line.ma_hang || '').trim().toLowerCase()
              && (!line.ten_nvl_sx || String(leg.ten_nvl_sx || '').trim().toLowerCase() === String(line.ten_nvl_sx).trim().toLowerCase()));
            const ids = [...new Set(hits.map(hit => String(hit.id_danh_muc || '')).filter(Boolean))];
            return ids.length === 1 ? { ...line, material_id: ids[0], loai_danh_muc: 'kho_nvl' } : line;
          }) };
        }
        const next = cleanNvlDocument(source, kind, catalog, true);
        if (!same(numericLeaves(row), numericLeaves(next))) throw new Error('Đối chiếu số lượng/khối lượng/tiền thất bại, không lập thay đổi.');
        const keys = Object.keys(next).filter(k => !same(row[k], next[k]));
        // Removing relational columns needs an explicit null (JSON keys are removed recursively).
        for (const k of Object.keys(row)) if (!(k in next)) { next[k] = null; keys.push(k); }
        if (!keys.length) continue;
        changes.push({ table, id: row.id, updated_at: row.updated_at,
          before: Object.fromEntries(keys.map(k => [k, row[k] ?? null])),
          after: Object.fromEntries(keys.map(k => [k, next[k]])) }); changed++;
      } catch (e) { unresolved.push({ table, id: row.id, reason: String(e) }); }
    }
    summary.push({ table, scanned: rows.length, changed });
  }
  await writeFile(path.join(dir, 'changes.json'), JSON.stringify(changes, null, 2));
  await writeFile(path.join(dir, 'unresolved.json'), JSON.stringify(unresolved, null, 2));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', backup: dir, summary, unresolved: unresolved.length }, null, 2));
  if (!apply) return;
  if (unresolved.length) throw new Error('Chưa ghi DB: còn vật liệu không xác định duy nhất; xem unresolved.json.');
  const applied: string[] = []; await writeFile(path.join(dir, 'applied.json'), '[]');
  for (const c of changes) {
    const { data: current, error: readError } = await db.from(c.table).select('*').eq('id', c.id).single();
    if (readError || !Object.keys(c.before).every(k => same(current?.[k], c.before[k]))) throw new Error(`${c.table}/${c.id} đã thay đổi, dừng migration.`);
    let query = db.from(c.table).update(c.after).eq('id', c.id);
    if (c.updated_at) query = query.eq('updated_at', c.updated_at);
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(`${c.table}/${c.id}: ${error.message}`);
    applied.push(`${c.table}/${c.id}`); await writeFile(path.join(dir, 'applied.json'), JSON.stringify(applied));
    if (!Object.keys(c.after).every(k => same(data?.[k], c.after[k])) || !same(numericLeaves(current), numericLeaves(data))) throw new Error(`${c.table}/${c.id}: đối chiếu sau ghi thất bại; bản ghi đã được ghi vào nhật ký khôi phục.`);
  }
  console.log(`Verified ${applied.length} updated records; quantities and money untouched.`);
}
main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
