/**
 * Viber notify 1-chieu (OTP / don hang) - route he thong, chay chung trong server.ts (createApp),
 * nho do tu dong co mat tren ca local (tsx) va Vercel (api/_handler.cjs).
 * Pattern giong registerXuatNhapTongHopRoutes: nhan supabase client dung chung.
 *
 *   POST /api/notify                {to, text} -> chuan hoa 0xxx->84xxx, gui, luu message_uuid
 *   GET  /api/messages?limit=50     lich su (bang Supabase `viber_messages`, xem migration ke ben)
 *   POST /webhooks/vonage/status    nhan delivered/failed/... -> update DB, luon tra 200
 */
import type { Express } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeVnPhone, validateText } from './phone';
import { sendViberMessage, viberProvider } from './sender';

export type ViberNotifyDeps = {
  supabase: SupabaseClient | null;
  table: string;
};

type DbRow = {
  id: number;
  to_number: string;
  text: string;
  message_uuid: string;
  provider: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_webhook?: unknown;
};

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(error.message || '');
}

function toApiRow(r: DbRow) {
  return {
    id: r.id,
    to: r.to_number,
    text: r.text,
    messageUUID: r.message_uuid,
    provider: r.provider,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function registerViberNotifyRoutes(app: Express, deps: ViberNotifyDeps): void {
  const { supabase, table } = deps;

  // Gui thong bao 1-chieu: { to: "0912...", text: "OTP..." }
  app.post('/api/notify', async (req, res) => {
    try {
      const to = normalizeVnPhone(req.body?.to);
      const text = validateText(req.body?.text);
      const { message_uuid, provider } = await sendViberMessage(to, text);

      if (!supabase) {
        return res.json({ ok: true, to, messageUUID: message_uuid, provider, stored: false });
      }
      const { data, error } = await supabase
        .from(table)
        .insert({ to_number: to, text, message_uuid, provider, status: 'submitted' })
        .select('id')
        .single();
      if (error) {
        if (isMissingTable(error)) {
          console.warn(`[viber-notify] tin da gui (uuid=${message_uuid}) nhung chua co bang ${table} - chay migration supabase-viber-messages.sql.`);
          return res.json({ ok: true, to, messageUUID: message_uuid, provider, stored: false, warning: `Chua co bang ${table}.` });
        }
        console.error('[viber-notify] luu DB loi:', error.message);
        return res.json({ ok: true, to, messageUUID: message_uuid, provider, stored: false, warning: error.message });
      }
      return res.json({ ok: true, to, messageUUID: message_uuid, provider, id: (data as { id: number }).id });
    } catch (err: any) {
      const msg = err?.message || 'Loi gui tin.';
      const status = /^(Thieu|Noi dung|SDT|VIBER_PROVIDER)/.test(msg) ? 400 : 502;
      console.error('[viber-notify:error]', msg);
      return res.status(status).json({ ok: false, error: msg });
    }
  });

  // Lich su gui
  app.get('/api/messages', async (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 500));
    if (!supabase) return res.json({ ok: true, provider: viberProvider(), messages: [], stored: false });
    const { data, error } = await supabase
      .from(table)
      .select('id,to_number,text,message_uuid,provider,status,created_at,updated_at')
      .order('id', { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingTable(error)) {
        return res.json({ ok: true, provider: viberProvider(), messages: [], stored: false, warning: `Chua co bang ${table}.` });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
    return res.json({ ok: true, provider: viberProvider(), messages: ((data || []) as DbRow[]).map(toApiRow) });
  });

  // Webhook trang thai Vonage (delivered/failed/...): luon tra 200 de Vonage khong retry don.
  // Vonage Dashboard -> Messages API -> callbacks: https://<domain>/webhooks/vonage/status
  // Body mau: { message_uuid, status, timestamp, ... } (chiu ca dang mang va {messages:[...]}).
  app.post('/webhooks/vonage/status', async (req, res) => {
    try {
      console.log('[viber-notify:webhook]', JSON.stringify(req.body));
      const events = Array.isArray(req.body) ? req.body : req.body?.messages || [req.body];
      const updated: Array<{ messageUUID: string; status: string; found: boolean }> = [];
      for (const ev of events) {
        const uuid = ev?.message_uuid || ev?.messageUuid || ev?.id;
        const status = ev?.status || ev?.state || 'unknown';
        if (!uuid) continue;
        let found = false;
        if (supabase) {
          const { data } = await supabase
            .from(table)
            .update({ status: String(status), updated_at: new Date().toISOString(), last_webhook: ev })
            .eq('message_uuid', String(uuid))
            .select('id');
          found = Array.isArray(data) && data.length > 0;
        }
        updated.push({ messageUUID: String(uuid), status: String(status), found });
      }
      return res.status(200).json({ ok: true, updated });
    } catch (err: any) {
      console.error('[viber-notify:webhook:error]', err?.message);
      return res.status(200).json({ ok: true, warning: err?.message }); // van 200 de Vonage khong retry
    }
  });
}
