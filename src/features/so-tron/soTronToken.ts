import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SoTronActor, SoTronRole } from './soTronPhanQuyen';

type TokenBody = {
  sub: string;
  username: string;
  name: string;
  roles: SoTronRole[];
  ca: string;
  exp: number;
};

function b64url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

export function signSoTronToken(actor: SoTronActor, secret: string, ttlSec = 60 * 60 * 14): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      sub: actor.id,
      username: actor.username,
      name: actor.name,
      roles: actor.roles,
      ca: actor.ca,
      exp: Math.floor(Date.now() / 1000) + ttlSec
    } satisfies TokenBody)
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifySoTronToken(token: string, secret: string): SoTronActor | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !secret) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenBody;
    if (!payload?.sub || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return {
      id: String(payload.sub),
      username: String(payload.username || ''),
      name: String(payload.name || ''),
      roles: roles.filter((role): role is SoTronRole =>
        role === 'ADMIN' || role === 'TRUONG_CA' || role === 'TO_TRON' || role === 'NV_PX'
      ),
      ca: String(payload.ca || '')
    };
  } catch {
    return null;
  }
}
