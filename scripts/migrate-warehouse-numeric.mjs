import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sqlPath = path.join(process.cwd(), 'supabase-phieu-xuat-nhap-kho-so-luong-numeric.sql');
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
    console.error('Thiếu SUPABASE_DB_PASSWORD trong .env');
    console.error('Lấy mật khẩu tại Supabase → Project Settings → Database → Database password');
    console.error('Hoặc chạy thủ công file supabase-phieu-xuat-nhap-kho-so-luong-numeric.sql trong SQL Editor.');
    process.exit(1);
  }

  const candidates = connectionCandidates(password);
  let lastError = null;

  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      await client.query(sql);
      console.log('Đã chuyển cột so_luong/don_gia/thanh_tien sang numeric.');
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

  console.error('Không thể kết nối hoặc chạy migration:', lastError?.message || lastError);
  process.exit(1);
}

run();
