/**
 * Bỏ cột san_pham.ten_ghep (chỉ giữ ten_san_xuat).
 * Cần SUPABASE_DB_PASSWORD hoặc SUPABASE_DB_URL trong .env
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const FILE = 'supabase-san-pham-ten-ghep.sql';

function projectRef() {
  const url = process.env.SUPABASE_URL || '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || '';
}

function connectionCandidates(password) {
  const ref = projectRef();
  const custom = process.env.SUPABASE_DB_URL?.trim();
  if (custom) return [custom];
  if (!ref || !password) return [];
  return [
    `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`
  ];
}

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const candidates = connectionCandidates(password);
  if (candidates.length === 0) {
    console.error('Thiếu SUPABASE_DB_PASSWORD hoặc SUPABASE_DB_URL trong .env');
    console.error('Hoặc chạy thủ công trong Supabase SQL Editor:', FILE);
    process.exit(1);
  }

  let lastError = null;
  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      const sql = fs.readFileSync(path.join(process.cwd(), FILE), 'utf8');
      await client.query(sql);
      console.log('OK', FILE);
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  console.error('Không chạy được migration:', lastError?.message || lastError);
  process.exit(1);
}

run();
