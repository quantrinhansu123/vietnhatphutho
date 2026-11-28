import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';

dotenv.config({ quiet: true });
const DIR = 'outputs/reimport-dual-20261123';
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

await mkdir(DIR, { recursive: true });
const tables = ['san_pham', 'san_pham_mb', 'san_pham_mn', 'san_pham_quy_doi', 'san_pham_audit_log'];
const counts = {};
for (const table of tables) {
  const rows = await all(table);
  counts[table] = rows.length;
  await writeFile(`${DIR}/before-${table}.json`, JSON.stringify(rows));
  console.log(table, rows.length);
}
await writeFile(`${DIR}/counts-before.json`, JSON.stringify(counts, null, 2));
console.log('snapshot done', counts);
