import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export function cleanNames(value) {
  if (Array.isArray(value)) return value.map(cleanNames);
  if (!value || typeof value !== 'object') return value;
  const { ten_ghep, tenGhep, ...rest } = value;
  const result = Object.fromEntries(Object.entries(rest).map(([key, item]) => [key, cleanNames(item)]));
  if (!String(result.ten_san_xuat || '').trim() && (ten_ghep || tenGhep)) result.ten_san_xuat = String(ten_ghep || tenGhep).trim();
  return result;
}
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
const sameData = (a,b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
export function storedProducts(raw) { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
export function repairDh012(items, catalog) {
  if (!Array.isArray(items)) throw Error('DH012: expected product array');
  const replacements = new Map([
    ['26eba6ad-b646-4302-afc4-358f2c19c3a1', 'c3c98494-4a17-4513-9763-1c6d63352026'],
    ['5fd35714-cb04-4019-9338-be66ba640355', 'c05cb85d-ccb5-4e5f-abb9-46108e66c1f7']
  ]);
  const truncate = value => Math.trunc((Number(value) / 3 + 1e-9) * 1000) / 1000;
  return items.map((item, index) => {
    if (![6, 7].includes(Number(item.stt || index + 1))) return item;
    const targetId = replacements.get(item.san_pham_id);
    if (!targetId) { if ([...replacements.values()].includes(item.san_pham_id)) return item; throw Error('DH012: unexpected product ID on line 6/7'); }
    const target = catalog.find(p => String(p.id) === targetId);
    if (!target || target.ma_sp !== item.ma_sp || !/ - 2m$/i.test(target.ten_san_xuat)) throw Error('DH012: target 2m product not verified');
    const result = {...item, san_pham_id: targetId, ten_san_xuat: target.ten_san_xuat, dai_m: 2, quy_cach_m_dai: 2};
    for (const key of ['m2','m_dai','tong_kg']) if (item[key] != null) result[key] = truncate(item[key]);
    for (const key of ['tl_tam','tl_cuon','kg_1_sp']) if (item[key] != null) result[key] = Math.round(Number(item[key]) / 3 * 1e6) / 1e6;
    if (Array.isArray(item.ket_qua_quy_doi)) result.ket_qua_quy_doi = item.ket_qua_quy_doi.map(row => /^(kg|m2|m²|m dài|m_dai)$/iu.test(String(row.don_vi).trim()) ? {...row, gia_tri: truncate(row.gia_tri)} : row);
    if (item.kq_quy_doi) result.kq_quy_doi = {...item.kq_quy_doi, ...Object.fromEntries(['trong_luong_kg','chieu_dai_m'].filter(key=>item.kq_quy_doi[key]!=null).map(key=>[key,truncate(item.kq_quy_doi[key])]))};
    return result;
  });
}
async function run() {
  dotenv.config({ quiet: true });
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY, {auth:{persistSession:false}});
  const apply = process.argv.includes('--apply');
  const folder = path.resolve('outputs', `order-name-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(folder,{recursive:true});
  const plans=[];
  const catalogIds = ['c3c98494-4a17-4513-9763-1c6d63352026','c05cb85d-ccb5-4e5f-abb9-46108e66c1f7'];
  const {data:catalog,error:catalogError}=await db.from(process.env.SUPABASE_PRODUCTS_TABLE||'san_pham').select('id,ma_sp,ten_san_xuat').in('id',catalogIds);
  if(catalogError)throw Error(catalogError.message);
  await writeFile(path.join(folder,'catalog-reference.json'),JSON.stringify(catalog,null,2));
  for (const table of [process.env.SUPABASE_ORDERS_TABLE || 'don_hang',process.env.SUPABASE_PRODUCTION_ORDERS_TABLE || 'lenh_sx']) {
    const rows=[];
    for(let offset=0;;offset+=500){const {data,error}=await db.from(table).select('*').order('id').range(offset,offset+499);if(error)throw Error(`${table}: ${error.message}`);rows.push(...data);if(data.length<500)break;}
    await writeFile(path.join(folder,`${table}-before.json`),JSON.stringify(rows,null,2));
    for(const row of rows){let next=cleanNames(storedProducts(row.san_pham));if(row.ma_don_hang==='DH012' && !row.ma_lenh_sx || row.ma_lenh_sx==='LSX-DH012')next=repairDh012(next,catalog);const encoded=typeof row.san_pham==='string'?JSON.stringify(next):next;if(!sameData(encoded,row.san_pham))plans.push({table,row,next:encoded});}
    console.log(`${table}: inspected ${rows.length} records`);
  }
  const report=plans.map(({table,row})=>({table,id:row.id,code:row.ma_lenh_sx||row.ma_don_hang}));
  await writeFile(path.join(folder,'plan.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',count:plans.length,backup:folder,records:report}));
  if(!apply)return;
  let applied=[];
  for(const {table,row,next}of plans){
    const {data:live,error:readError}=await db.from(table).select('san_pham').eq('id',row.id).single();if(readError||!sameData(live.san_pham,row.san_pham))throw Error(`${table}/${row.id}: concurrent change`);
    let query=db.from(table).update({san_pham:next}).eq('id',row.id);if(row.updated_at)query=query.eq('updated_at',row.updated_at);
    const {data,error}=await query.select('id,san_pham');if(error||data?.length!==1||!sameData(data[0].san_pham,next))throw Error(`${table}/${row.id}: ${error?.message||'verification failed'}`);
    applied.push({table,id:row.id});await writeFile(path.join(folder,'applied.json'),JSON.stringify(applied));
  }
  console.log(`Verified ${applied.length} updated records`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run().catch(e=>{console.error(e.message);process.exitCode=1;});
