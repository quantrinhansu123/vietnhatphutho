/**
 * Sender Viber 1-chieu (OTP / don hang). Doi provider chi bang .env VIBER_PROVIDER - khong sua code:
 *   log            -> fake, in console, khong can key (mac dinh dev)
 *   vonage_sandbox -> https://messages-sandbox.nexmo.com, from=16273, chi toi may whitelist (100 tin/thang)
 *   vonage_prod    -> https://api.nexmo.com, from = Business ID that (Viber Service ID)
 *   infobip        -> Infobip Viber API (/viber/2/messages), trial 100 tin toi so verify, sender IBSelfServe
 * Vonage dung Basic Auth (key:secret); Infobip dung header "Authorization: App <key>".
 * Khong dung Bot API (chatapi.viber.com), khong chat 2-chieu.
 */
import crypto from 'crypto';

export type ViberProvider = 'log' | 'vonage_sandbox' | 'vonage_prod' | 'infobip';
export type SendResult = { message_uuid: string; provider: string };

function currentProvider(): string {
  return process.env.VIBER_PROVIDER || 'log';
}

async function sendViaLog(to: string, text: string): Promise<SendResult> {
  const message_uuid = `log-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  console.log(`[viber-notify:log] to=${to} text=${JSON.stringify(text)} uuid=${message_uuid}`);
  return { message_uuid, provider: 'log' };
}

/**
 * Viber Business Messages qua Vonage Messages API v1.
 * POST {host}/v1/messages (Basic Auth key:secret),
 * body { from, to, channel: "viber", message_type: "text", text } -> 202 { message_uuid }
 */
async function sendViaVonage(to: string, text: string): Promise<SendResult> {
  const provider = currentProvider();
  const isSandbox = provider === 'vonage_sandbox';
  const host = (
    isSandbox
      ? process.env.VONAGE_SANDBOX_HOST || 'https://messages-sandbox.nexmo.com'
      : process.env.VONAGE_PROD_HOST || 'https://api.nexmo.com'
  ).replace(/\/$/, '');
  const from = isSandbox
    ? process.env.VONAGE_SANDBOX_FROM || '16273'
    : process.env.VONAGE_VIBER_SENDER_ID || process.env.VONAGE_PROD_FROM || '';
  const key = process.env.VONAGE_API_KEY || '';
  const secret = process.env.VONAGE_API_SECRET || '';

  if (!key || !secret) throw new Error(`Thieu VONAGE_API_KEY / VONAGE_API_SECRET trong .env (mode=${provider}).`);
  if (!from) {
    throw new Error(
      isSandbox
        ? 'Thieu VONAGE_SANDBOX_FROM (sandbox mac dinh "16273").'
        : 'Thieu VONAGE_VIBER_SENDER_ID (Business ID / Viber Service ID prod) trong .env.'
    );
  }

  const url = `${host}/v1/messages`;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  console.log(`[viber-notify:${provider}] POST ${url} from=${from} to=${to}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: String(from), to, channel: 'viber', message_type: 'text', text })
  });
  const raw = await res.text();
  let data: Record<string, any> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, any>) : {};
  } catch {
    data = { _raw: raw };
  }
  if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
    const detail = data?.detail || data?.title || data?.error ? JSON.stringify(data) : raw;
    throw new Error(`Vonage ${res.status}: ${detail || res.statusText}`);
  }
  const message_uuid: string | undefined =
    data.message_uuid || (Array.isArray(data.message_uuids) ? data.message_uuids[0] : undefined);
  if (!message_uuid) throw new Error(`Vonage tra ${res.status} nhung khong co message_uuid: ${raw}`);
  return { message_uuid, provider };
}

/**
 * Viber qua Infobip API.
 * POST {baseUrl}/viber/2/messages (header "Authorization: App <key>"),
 * body { messages: [{ sender, destinations: [{ to }], content: { text, type: "TEXT" } }] }
 * -> 200 { messages: [{ messageId, status, to }] }
 * Trial: chi toi so da verify, sender = test sender (IBSelfServe).
 */
async function sendViaInfobip(to: string, text: string): Promise<SendResult> {
  const provider = currentProvider();
  const baseUrl = (process.env.INFOBIP_BASE_URL || '').replace(/\/$/, '');
  const apiKey = process.env.INFOBIP_API_KEY || '';
  const sender = process.env.INFOBIP_VIBER_SENDER || 'IBSelfServe';

  if (!baseUrl) throw new Error('Thieu INFOBIP_BASE_URL trong .env (vd https://1eqpw1.api.infobip.com).');
  if (!apiKey) throw new Error('Thieu INFOBIP_API_KEY trong .env (copy tu portal Infobip).');

  const url = `${baseUrl}/viber/2/messages`;
  console.log(`[viber-notify:${provider}] POST ${url} sender=${sender} to=${to}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      messages: [{ sender: String(sender), destinations: [{ to }], content: { text, type: 'TEXT' } }]
    })
  });
  const raw = await res.text();
  let data: Record<string, any> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, any>) : {};
  } catch {
    data = { _raw: raw };
  }
  if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : raw;
    throw new Error(`Infobip ${res.status}: ${detail || res.statusText}`);
  }
  const first = Array.isArray(data.messages) ? data.messages[0] : undefined;
  const message_uuid: string | undefined =
    first?.messageId || first?.messageUUID || data.message_uuid || data.messageId;
  if (!message_uuid) throw new Error(`Infobip tra ${res.status} nhung khong co messageId: ${raw}`);
  return { message_uuid, provider };
}

export async function sendViberMessage(to: string, text: string): Promise<SendResult> {
  const provider = currentProvider();
  if (provider === 'log') return sendViaLog(to, text);
  if (provider === 'vonage_sandbox' || provider === 'vonage_prod') return sendViaVonage(to, text);
  if (provider === 'infobip') return sendViaInfobip(to, text);
  throw new Error(`VIBER_PROVIDER khong hop le: "${provider}" (chon log|vonage_sandbox|vonage_prod|infobip).`);
}

export function viberProvider(): string {
  return currentProvider();
}
