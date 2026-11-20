import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function projectRef() {
  const url = process.env.SUPABASE_URL || '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || '';
}

function connectionCandidates(password) {
  const ref = projectRef();
  const custom = process.env.SUPABASE_DB_URL?.trim();
  const region = process.env.SUPABASE_DB_POOLER_REGION?.trim() || 'ap-northeast-1';
  const list = [];
  if (custom) list.push(custom);
  if (ref && password) {
    list.push(
      `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
    );
  }
  return list;
}

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password && !process.env.SUPABASE_DB_URL?.trim()) {
    console.error('Thiếu SUPABASE_DB_PASSWORD hoặc SUPABASE_DB_URL');
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
      const jobs = [
        { table: 'san_pham_mb', mien: 'Miền Bắc' },
        { table: 'san_pham_mn', mien: 'Miền Nam' }
      ];
      for (const job of jobs) {
        await client.query(`DROP TABLE IF EXISTS public.${job.table} CASCADE`);
        await client.query(
          `
          CREATE TABLE public.${job.table} AS
          SELECT *
          FROM public.san_pham
          WHERE mien = $1
        `,
          [job.mien]
        );
        await client.query(`
          ALTER TABLE public.${job.table}
          ADD CONSTRAINT ${job.table}_pkey PRIMARY KEY (id)
        `);
        const count = await client.query(`SELECT COUNT(*)::int AS n FROM public.${job.table}`);
        console.log(`OK: ${job.table} — ${count.rows[0].n} dòng (mien = ${job.mien})`);
      }
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

  console.error(lastError?.message || lastError);
  process.exit(1);
}

run();
