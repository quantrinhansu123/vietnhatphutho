/**
 * Auto thong bao don hang moi ve SDT noi bo co dinh.
 * Cau hinh bang .env VIBER_ORDER_NOTIFY_TO="0912...,0987..." (phan cach , ; | hoac space).
 * Khong chan tao don: loi gui chi log, khong throw ra API don-hang.
 * (comment khong dau de tranh loi encoding tren Windows console)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeVnPhone } from './phone';
import { sendViberMessage } from './sender';

export type OrderNotifyDeps = {
  supabase: SupabaseClient | null;
  table: string;
};

/** Parse danh sach SDT noi bo tu env, chuan hoa 0xxx -> 84xxx, loai trung + bo qua so sai. */
export function getOrderNotifyTargets(): string[] {
  const raw = process.env.VIBER_ORDER_NOTIFY_TO || '';
  if (!raw.trim()) return [];
  // Chi tach theo , ; | xuong dong (giu space ben trong de normalizeVnPhone xu ly "0912 345 678").
  const parts = raw.split(/[,;|\r\n]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    try {
      const norm = normalizeVnPhone(p);
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(norm);
      }
    } catch (err: any) {
      console.warn(`[viber-notify:order] bo qua SDT noi bo sai: "${p}" (${err?.message || err})`);
    }
  }
  return out;
}

function formatDateVN(iso: unknown): string {
  const s = String(iso ?? '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso ?? '').trim() || '-';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type OrderLike = Record<string, any>;

/** Template tin don moi (co dau, <= 1000 ky tu). */
export function buildNewOrderText(order: OrderLike): string {
  const ma = String(order?.ma_don_hang ?? '').trim() || '(chua co ma)';
  const khach = String(order?.khach_hang ?? '').trim() || '-';
  const loai = String(order?.loai_don_hang ?? '').trim() || '-';
  const giao = order?.ngay_giao_hang ? formatDateVN(order.ngay_giao_hang) : '-';
  const nv = String(order?.nhan_vien ?? '').trim();
  const ghiChu = String(order?.ghi_chu ?? '').trim();

  let spSummary = '';
  const sp = (order as { san_pham?: unknown }).san_pham;
  if (Array.isArray(sp) && sp.length > 0) {
    let tongSL = 0;
    let tongKg = 0;
    for (const line of sp) {
      const l = line as Record<string, any>;
      const sl = Number(l?.so_luong);
      if (Number.isFinite(sl) && sl > 0) tongSL += sl;
      const kg = Number(l?.tong_kg);
      if (Number.isFinite(kg) && kg > 0) tongKg += kg;
    }
    const parts: string[] = [`${sp.length} dong`];
    if (tongSL > 0) parts.push(`${tongSL} SL`);
    if (tongKg > 0) parts.push(`${tongKg}kg`);
    spSummary = parts.join(', ');
  }

  const lines = [
    `Don hang moi: ${ma}`,
    `Khach: ${khach}`,
    `Loai: ${loai}`,
    `Giao: ${giao}`
  ];
  if (spSummary) lines.push(`SP: ${spSummary}`);
  if (nv) lines.push(`NV: ${nv}`);
  if (ghiChu) lines.push(`Ghi chu: ${ghiChu.slice(0, 200)}`);

  let text = lines.join('\n');
  if (text.length > 1000) text = text.slice(0, 997) + '...';
  return text;
}

/**
 * Gui tin don moi toi toan bo SDT noi bo, luu lich su nhu POST /api/notify.
 * Khong throw: tra void, loi chi console.error de khong lam hong API tao don.
 */
export async function notifyNewOrder(order: OrderLike, deps: OrderNotifyDeps): Promise<void> {
  try {
    const targets = getOrderNotifyTargets();
    if (targets.length === 0) return;
    const text = buildNewOrderText(order);
    if (!text.trim()) return;
    const { supabase, table } = deps;
    for (const to of targets) {
      try {
        const { message_uuid, provider } = await sendViberMessage(to, text);
        if (!supabase) continue;
        const { error } = await supabase
          .from(table)
          .insert({ to_number: to, text, message_uuid, provider, status: 'submitted' });
        if (error) {
          console.warn(`[viber-notify:order] da gui ${message_uuid} nhung luu DB loi: ${error.message}`);
        }
      } catch (err: any) {
        console.error(`[viber-notify:order] gui ve ${to} loi:`, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error('[viber-notify:order] loi chung:', err?.message || err);
  }
}
