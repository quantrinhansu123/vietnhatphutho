import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

dotenv.config({ quiet: true });
const DIR = 'outputs/reimport-dual-20261123';
const APPLY = process.argv.includes('--apply');
const read = async (p) => JSON.parse(await readFile(`${DIR}/${p}`, 'utf8'));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('Missing SUPABASE_URL / SERVICE_ROLE_KEY');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function all(table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select('*').order('id').range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function batches(rows, fn) {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await fn(chunk);
    if (error) throw new Error(error.message);
  }
}

async function clearTable(table) {
  // Delete all rows in pages by id
  for (;;) {
    const { data, error } = await db.from(table).select('id').limit(500);
    if (error) throw new Error(`clear select ${table}: ${error.message}`);
    if (!data?.length) break;
    const ids = data.map((r) => r.id);
    const { error: delError } = await db.from(table).delete().in('id', ids);
    if (delError) throw new Error(`clear delete ${table}: ${delError.message}`);
  }
}

function canon(rows) {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((r) => Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b))))
  );
}

const preparedMb = await read('prepared-mb.json');
const preparedMn = await read('prepared-mn.json');
const before = {
  products: await read('before-san_pham.json'),
  mb: await read('before-san_pham_mb.json'),
  mn: await read('before-san_pham_mn.json'),
  conversions: await read('before-san_pham_quy_doi.json')
};

const mbIds = new Set(preparedMb.records.map((r) => r.product.id));
const mnIds = new Set(preparedMn.records.map((r) => r.product.id));
const overlap = [...mbIds].filter((id) => mnIds.has(id));
if (overlap.length) throw new Error(`MB/MN ID overlap: ${overlap.slice(0, 5).join(',')}`);

const dry = {
  willClear: {
    san_pham_quy_doi: before.conversions.length,
    san_pham_mb: before.mb.length,
    san_pham_mn: before.mn.length,
    san_pham: before.products.length
  },
  willInsert: {
    mb: preparedMb.records.length,
    mn: preparedMn.records.length,
    san_pham: preparedMb.records.length + preparedMn.records.length,
    quy_doi: preparedMb.records.length + preparedMn.records.length
  },
  precision: preparedMb.precision
};
console.log(JSON.stringify(dry, null, 2));
if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to clear + import.');
  process.exit(0);
}

const productFields = [
  'ma_amis',
  'ten_sp',
  'ten_san_xuat',
  'nhom_vthh',
  'don_vi',
  'mien',
  'ten_goc',
  'so_song',
  'zem',
  'hang_phe',
  'mang',
  'tcmb',
  'do_li',
  'do_li_dm',
  'dinh_muc_kg',
  'do_dai_tam_tieu_chuan',
  'kho_rong',
  'do_dai_m',
  'mau',
  'gia_re',
  'tcmn',
  'ty_le_hao_hut'
];

async function verifyRegion(prepared, regionTable) {
  const products = await all(regionTable);
  const conv = await all('san_pham_quy_doi');
  if (products.length !== prepared.records.length) {
    throw new Error(`${regionTable} count ${products.length} != prepared ${prepared.records.length}`);
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const diffs = [];
  for (const r of prepared.records) {
    const actual = byId.get(r.product.id);
    if (!actual) {
      diffs.push({ id: r.product.id, error: 'missing' });
      continue;
    }
    for (const f of productFields) {
      if ((actual[f] ?? null) !== (r.product[f] ?? null)) {
        diffs.push({ row: r.sourceRows, field: f, expected: r.product[f], actual: actual[f] });
      }
    }
    const c = conv.filter((x) => x.san_pham_id === r.product.id);
    if (c.length !== 1) {
      diffs.push({ row: r.sourceRows, error: `conversion count ${c.length}` });
      continue;
    }
    for (const [k, v] of Object.entries(r.conversion)) {
      if ((c[0][k] ?? null) !== v) diffs.push({ row: r.sourceRows, field: k, expected: v, actual: c[0][k] });
    }
  }
  return diffs;
}

async function restoreBackup() {
  console.error('Restoring from before-*.json ...');
  // Best-effort restore: clear again then insert backups
  for (const table of ['san_pham_quy_doi', 'san_pham_mb', 'san_pham_mn', 'san_pham']) {
    await clearTable(table);
  }
  await batches(before.products, (b) => db.from('san_pham').insert(b));
  await batches(before.conversions, (b) => db.from('san_pham_quy_doi').insert(b));
  await batches(before.mb, (b) => db.from('san_pham_mb').insert(b));
  await batches(before.mn, (b) => db.from('san_pham_mn').insert(b));
  console.error('Restore completed');
}

try {
  console.log('CLEAR san_pham_quy_doi');
  await clearTable('san_pham_quy_doi');
  console.log('CLEAR san_pham_mb');
  await clearTable('san_pham_mb');
  console.log('CLEAR san_pham_mn');
  await clearTable('san_pham_mn');
  console.log('CLEAR san_pham');
  await clearTable('san_pham');

  const countsAfterClear = {
    san_pham: (await all('san_pham')).length,
    san_pham_mb: (await all('san_pham_mb')).length,
    san_pham_mn: (await all('san_pham_mn')).length,
    san_pham_quy_doi: (await all('san_pham_quy_doi')).length
  };
  await writeFile(`${DIR}/counts-after-clear.json`, JSON.stringify(countsAfterClear, null, 2));
  if (Object.values(countsAfterClear).some((n) => n !== 0)) {
    throw new Error(`Clear incomplete: ${JSON.stringify(countsAfterClear)}`);
  }

  const mbProducts = preparedMb.records.map((r) => r.product);
  const mnProducts = preparedMn.records.map((r) => r.product);
  const mbConv = preparedMb.records.map((r) => ({
    ...r.conversion,
    san_pham_id: r.product.id,
    created_at: r.product.created_at,
    updated_at: r.product.updated_at
  }));
  const mnConv = preparedMn.records.map((r) => ({
    ...r.conversion,
    san_pham_id: r.product.id,
    created_at: r.product.created_at,
    updated_at: r.product.updated_at
  }));

  console.log('INSERT san_pham MB', mbProducts.length);
  await batches(mbProducts, (b) => db.from('san_pham').insert(b));
  console.log('INSERT san_pham_quy_doi MB', mbConv.length);
  await batches(mbConv, (b) => db.from('san_pham_quy_doi').insert(b));
  console.log('INSERT san_pham_mb', mbProducts.length);
  await batches(mbProducts, (b) => db.from('san_pham_mb').insert(b));

  console.log('INSERT san_pham MN', mnProducts.length);
  await batches(mnProducts, (b) => db.from('san_pham').insert(b));
  console.log('INSERT san_pham_quy_doi MN', mnConv.length);
  await batches(mnConv, (b) => db.from('san_pham_quy_doi').insert(b));
  console.log('INSERT san_pham_mn', mnProducts.length);
  await batches(mnProducts, (b) => db.from('san_pham_mn').insert(b));

  console.log('VERIFY MB');
  const mbDiffs = await verifyRegion(preparedMb, 'san_pham_mb');
  console.log('VERIFY MN');
  const mnDiffs = await verifyRegion(preparedMn, 'san_pham_mn');

  const parent = await all('san_pham');
  const countsAfter = {
    san_pham: parent.length,
    san_pham_mb: (await all('san_pham_mb')).length,
    san_pham_mn: (await all('san_pham_mn')).length,
    san_pham_quy_doi: (await all('san_pham_quy_doi')).length
  };

  await writeFile(
    `${DIR}/verification-mb.json`,
    JSON.stringify({ mismatches: mbDiffs.slice(0, 50), mismatchCount: mbDiffs.length }, null, 2)
  );
  await writeFile(
    `${DIR}/verification-mn.json`,
    JSON.stringify({ mismatches: mnDiffs.slice(0, 50), mismatchCount: mnDiffs.length }, null, 2)
  );

  if (mbDiffs.length || mnDiffs.length) {
    throw new Error(`Verification failed mb=${mbDiffs.length} mn=${mnDiffs.length}`);
  }
  if (countsAfter.san_pham !== mbProducts.length + mnProducts.length) {
    throw new Error(`Parent count mismatch ${countsAfter.san_pham}`);
  }

  const auditsMb = preparedMb.records.map((r) => ({
    san_pham_id: r.product.id,
    ma_sp: r.product.ma_sp,
    ma_amis: r.product.ma_amis,
    ten_sp: r.product.ten_sp,
    action: 'create',
    actor_username: 'master-data-import-mb',
    actor_name: preparedMb.batchId,
    changes: {
      master_import: {
        sourceSha256: preparedMb.sourceSha256,
        sheet: preparedMb.sourceSheet,
        sourceRows: r.sourceRows,
        precision: preparedMb.precision,
        mode: 'clear-then-insert'
      },
      conversion: { new: r.conversion }
    }
  }));
  const auditsMn = preparedMn.records.map((r) => ({
    san_pham_id: r.product.id,
    ma_sp: r.product.ma_sp,
    ma_amis: r.product.ma_amis,
    ten_sp: r.product.ten_sp,
    action: 'create',
    actor_username: 'master-data-import-mn',
    actor_name: preparedMn.batchId,
    changes: {
      master_import: {
        sourceSha256: preparedMn.sourceSha256,
        sheet: preparedMn.sourceSheet,
        sourceRows: r.sourceRows,
        precision: preparedMn.precision,
        mode: 'clear-then-insert'
      },
      conversion: { new: r.conversion }
    }
  }));
  await batches(auditsMb, (b) => db.from('san_pham_audit_log').insert(b));
  await batches(auditsMn, (b) => db.from('san_pham_audit_log').insert(b));

  const result = {
    success: true,
    countsAfterClear,
    countsAfter,
    mb: { batchId: preparedMb.batchId, products: mbProducts.length },
    mn: { batchId: preparedMn.batchId, products: mnProducts.length },
    precision: preparedMb.precision,
    completedAt: new Date().toISOString()
  };
  await writeFile(`${DIR}/counts-after.json`, JSON.stringify(countsAfter, null, 2));
  await writeFile(`${DIR}/result.json`, JSON.stringify(result, null, 2));
  console.log('COMPLETE', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('IMPORT FAILED:', error.message);
  await writeFile(
    `${DIR}/apply-error.json`,
    JSON.stringify({ error: error.message, at: new Date().toISOString() }, null, 2)
  );
  try {
    await restoreBackup();
  } catch (restoreError) {
    await writeFile(
      `${DIR}/restore-error.json`,
      JSON.stringify({ importError: error.message, restoreError: restoreError.message }, null, 2)
    );
    console.error('RESTORE FAILED:', restoreError.message);
  }
  process.exit(1);
}
