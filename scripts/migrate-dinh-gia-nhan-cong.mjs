import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sqlPath = path.join(process.cwd(), 'supabase-dinh-gia-nhan-cong.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

function projectRef() {
  const url = process.env.SUPABASE_URL || '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || '';
}

function connectionCandidates(password) {
  const ref = projectRef();
  if (!ref || !password) return [];

  const custom = process.env.SUPABASE_DB_URL?.trim();
  if (custom) return [custom];

  return [
    `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`
  ];
}

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    console.log('NOTICE: SUPABASE_DB_PASSWORD not found in .env. Table can be created manually in Supabase SQL Editor if needed.');
    return;
  }

  const urls = connectionCandidates(password);
  let ok = false;
  for (const connectionString of urls) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      console.log('SUCCESS: Table dinh_gia_nhan_cong created or updated successfully.');
      ok = true;
      await client.end();
      break;
    } catch (e) {
      try { await client.end(); } catch {}
    }
  }

  if (!ok) {
    console.log('NOTICE: Could not connect directly to postgres. You can run supabase-dinh-gia-nhan-cong.sql in Supabase SQL Editor.');
  }
}

run();
