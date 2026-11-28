import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { reorderProductionNameQualifiers } from '../src/utils/productProductionName.ts';

dotenv.config();

const PAGE_SIZE = 1000;
const AUDIT_BATCH_SIZE = 100;
const CONCURRENCY = 12;
const apply = process.argv.includes('--apply');
const baseTable = process.env.SUPABASE_PRODUCTS_TABLE || 'san_pham';
const tables = [...new Set([baseTable, 'san_pham_mb', 'san_pham_mn'])];
const auditTable = process.env.SUPABASE_PRODUCT_AUDIT_LOG_TABLE || 'san_pham_audit_log';
const actor = 'codex-production-name-structure';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) throw new Error('Thiếu SUPABASE_URL hoặc service-role key.');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function readAllProducts(table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('id, ma_sp, ma_amis, ten_sp, ten_san_xuat, mang')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Đọc ${table} lỗi: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const tableRows = new Map();
for (const table of tables) tableRows.set(table, await readAllProducts(table));

const copiesById = new Map();
for (const [table, rows] of tableRows) {
  for (const row of rows) {
    const id = String(row.id || '');
    const oldName = String(row.ten_san_xuat || '').trim();
    if (!id || !oldName) continue;
    const copies = copiesById.get(id) || new Map();
    copies.set(table, {
      ...row,
      oldName,
      newName: reorderProductionNameQualifiers(oldName, String(row.mang || ''))
    });
    copiesById.set(id, copies);
  }
}

const changed = new Map();
const inconsistentCopies = [];
for (const [id, copies] of copiesById) {
  const candidates = [...copies.values()].filter(row => row.newName !== row.oldName);
  if (!candidates.length) continue;
  const nextNames = new Set([...copies.values()].map(row => row.newName));
  if (nextNames.size > 1) {
    inconsistentCopies.push({ id, copies: [...copies.entries()].map(([table, row]) => ({
      table, before: row.oldName, after: row.newName
    })) });
    continue;
  }
  changed.set(id, copies);
}

const collisionIds = new Set();
const collisionGroups = [];
for (const [table, rows] of tableRows) {
  const proposedByIdentity = new Map();
  for (const row of rows) {
    const id = String(row.id || '');
    const candidate = changed.get(id)?.get(table);
    const nextName = candidate?.newName || String(row.ten_san_xuat || '').trim();
    const key = [row.ma_amis || '', row.ten_sp || '', nextName].join('\u0000');
    const ids = proposedByIdentity.get(key) || [];
    ids.push(id);
    proposedByIdentity.set(key, ids);
  }
  for (const ids of proposedByIdentity.values()) {
    if (ids.length < 2) continue;
    const affected = ids.filter(id => changed.has(id));
    if (!affected.length) continue;
    collisionGroups.push({ table, ids, changedIds: affected });
    affected.forEach(id => collisionIds.add(id));
  }
}

const eligible = [...changed.entries()].filter(([id]) => !collisionIds.has(id));
const eligibleByTable = Object.fromEntries(tables.map(table => [table, eligible.filter(([, copies]) => {
  const row = copies.get(table);
  return row && row.newName !== row.oldName;
}).length]));

const auditProbe = await supabase.from(auditTable).select('id').limit(1);
if (auditProbe.error) throw new Error(`Không đọc được ${auditTable}: ${auditProbe.error.message}`);

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  productsToUpdate: eligible.length,
  updatesPerTable: eligibleByTable,
  skippedIdentityCollisions: collisionIds.size,
  collisionGroups: collisionGroups.length,
  inconsistentCopies: inconsistentCopies.length,
  samples: eligible.slice(0, 10).map(([id, copies]) => {
    const row = copies.get(baseTable) || [...copies.values()][0];
    return { id, before: row.oldName, after: row.newName };
  })
}, null, 2));

if (!apply) process.exit(0);

const auditRows = [];
for (let index = 0; index < eligible.length; index += CONCURRENCY) {
  const batch = eligible.slice(index, index + CONCURRENCY);
  await Promise.all(batch.map(async ([id, copies]) => {
    const changedCopies = [...copies.entries()].filter(([, row]) => row.newName !== row.oldName);
    const applied = [];
    try {
      await Promise.all(changedCopies.map(async ([table, row]) => {
        const { data, error } = await supabase
          .from(table)
          .update({ ten_san_xuat: row.newName })
          .eq('id', id)
          .eq('ten_san_xuat', row.oldName)
          .select('id')
          .maybeSingle();
        if (error) throw new Error(`${table}/${id}: ${error.message}`);
        if (!data) throw new Error(`${table}/${id}: tên đã đổi sau dry-run.`);
        applied.push({ table, id, oldName: row.oldName, newName: row.newName });
      }));

      const identity = copies.get(baseTable) || [...copies.values()][0];
      auditRows.push({
        san_pham_id: id,
        ma_sp: identity.ma_sp || null,
        ma_amis: identity.ma_amis || null,
        ten_sp: identity.ten_sp || null,
        action: 'update',
        actor_id: null,
        actor_username: actor,
        actor_name: 'Codex – chuẩn hóa cấu trúc tên sản xuất',
        changes: {
          ten_san_xuat: { old: identity.oldName, new: identity.newName, label: 'Tên sản xuất' }
        }
      });
    } catch (error) {
      await Promise.all(applied.map(item => supabase
        .from(item.table)
        .update({ ten_san_xuat: item.oldName })
        .eq('id', item.id)
        .eq('ten_san_xuat', item.newName)));
      throw error;
    }
  }));
}

for (let offset = 0; offset < auditRows.length; offset += AUDIT_BATCH_SIZE) {
  const { error } = await supabase.from(auditTable).insert(auditRows.slice(offset, offset + AUDIT_BATCH_SIZE));
  if (error) throw new Error(`Ghi ${auditTable} lỗi: ${error.message}`);
}

console.log(`Đã cập nhật ${eligible.length} sản phẩm; bảng: ${tables.join(', ')}; đã ghi ${auditRows.length} audit.`);
