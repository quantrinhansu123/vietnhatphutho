// Lấp ma_kho còn trống trong quan_ly_kho bằng slug tên Việt (không dấu, nối _).
// Chạy: node scripts/backfill-ma-kho.mjs
// Cần SUPABASE_URL + SUPABASE_SERVICE_KEY (hoặc SUPABASE_KEY) trong .env
// (SQL supabase-quan-ly-kho-ma-kho.sql đã lấp các kho chuẩn; script này lấp nốt kho còn lại).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

function slugMaKho(tenKho) {
  const slug = String(tenKho ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return slug;
}

async function run() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    '';
  if (!url || !key) {
    console.error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_KEY trong .env');
    process.exit(1);
  }
  const table = process.env.SUPABASE_QUAN_LY_KHO_TABLE || 'quan_ly_kho';
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from(table).select('id, ten_kho, ma_kho').limit(5000);
  if (error) {
    console.error('Không tải được quan_ly_kho:', error.message);
    process.exit(1);
  }
  const rows = Array.isArray(data) ? data : [];
  const used = new Set(
    rows.map(row => String(row.ma_kho ?? '').trim()).filter(Boolean)
  );
  let filled = 0;
  for (const row of rows) {
    if (String(row.ma_kho ?? '').trim()) continue;
    const base = slugMaKho(row.ten_kho) || 'kho';
    let candidate = base;
    for (let n = 2; used.has(candidate) && n < 1000; n += 1) {
      candidate = `${base}_${n}`;
    }
    if (used.has(candidate)) {
      console.warn(`Bỏ qua id=${row.id} (${row.ten_kho}): không tìm được mã duy nhất.`);
      continue;
    }
    const { error: updateError } = await supabase
      .from(table)
      .update({ ma_kho: candidate })
      .eq('id', row.id);
    if (updateError) {
      console.warn(`Lỗi id=${row.id}: ${updateError.message}`);
      continue;
    }
    used.add(candidate);
    filled += 1;
    console.log(`id=${row.id} ${row.ten_kho} → ${candidate}`);
  }
  console.log(`Xong: lấp ${filled}/${rows.length} kho.`);
}

run().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
