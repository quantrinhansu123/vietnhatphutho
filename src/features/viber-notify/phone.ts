/**
 * Chuan hoa + validate SDT Viet Nam cho Viber Business Messages.
 * Vonage yeu cau `to` o dang quoc te, khong dau +: 84xxxxxxxxx
 * (comment khong dau de tranh loi encoding tren Windows console).
 */

/** 0xxx (10 so) -> 84xxx; chap nhan +84 / 84 / 0084, kem space . - ( ). @throws Error tieng Viet (API bat -> 400). */
export function normalizeVnPhone(raw: unknown): string {
  if (raw === undefined || raw === null) throw new Error('Thieu so dien thoai (to).');
  let s = String(raw).trim();
  if (!s) throw new Error('Thieu so dien thoai (to).');

  s = s.replace(/[\s.\-()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+$/.test(s)) throw new Error(`SDT khong hop le: "${raw}" (chi chap nhan chu so, +84 hoac 0 o dau).`);

  if (s.startsWith('0084')) s = '84' + s.slice(4);
  else if (/^0\d{9}$/.test(s)) s = '84' + s.slice(1);

  if (!/^84\d{9,10}$/.test(s)) {
    throw new Error(`SDT khong hop le: "${raw}" (muon gui Viber VN: 0xxx 10 so hoac 84xxx).`);
  }
  if (!/^84(3|5|7|8|9)\d{8}$/.test(s)) {
    // Canh bao mem: van cho qua de test sandbox whitelist, khong chan cung so co dinh/doanh nghiep.
    console.warn(`[viber-notify] SDT ${s} khong thuoc dau so di dong pho bien (03/05/07/08/09) - van cho gui.`);
  }
  return s;
}

/** Validate text OTP/don hang: non-empty, <= 1000 ky tu (gioi han an toan cho Viber text). */
export function validateText(raw: unknown): string {
  if (raw === undefined || raw === null) throw new Error('Thieu noi dung (text).');
  const t = String(raw).trim();
  if (!t) throw new Error('Noi dung (text) rong.');
  if (t.length > 1000) throw new Error(`Noi dung qua dai (${t.length}/1000 ky tu).`);
  return t;
}
