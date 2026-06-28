import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  console.error('Thieu SUPABASE_URL / SUPABASE_SERVICE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function updateTable(table, payload, filterColumn) {
  const { data, error, count } = await supabase
    .from(table)
    .update(payload)
    .not(filterColumn, 'is', null)
    .select(filterColumn);

  if (error) throw new Error(`${table} update: ${error.message}`);
  console.log(`${table}: da cap nhat ${data?.length ?? count ?? 0} dong`);
  return data?.length ?? 0;
}

try {
  const nvlCount = await updateTable('kho_nvl', { ton_dau_ky: 100 }, 'ma_npl');
  const spCount = await updateTable('san_pham', { ton_dau_ky: 100 }, 'ma_sp');
  console.log(`Xong. kho_nvl=${nvlCount}, san_pham=${spCount}`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
