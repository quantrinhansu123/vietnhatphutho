/**
 * Client cho API phieu_nhap_kho (tach tu phieu_xuat_nhap_kho).
 * Cung response shape voi endpoint cu de panel hien tai tai su dung dan.
 */

export const PHIEU_NHAP_KHO_API = '/api/phieu-nhap-kho';

export type PhieuNhapKhoListParams = {
  loai_kho?: string;
  from?: string;
  to?: string;
  ma_phieu?: string;
  ma_npl?: string;
  ma_sp?: string;
};

export async function fetchPhieuNhapKho(params: PhieuNhapKhoListParams = {}) {
  const query = new URLSearchParams();
  if (params.loai_kho) query.set('loai_kho', params.loai_kho);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.ma_phieu) query.set('ma_phieu', params.ma_phieu);
  if (params.ma_npl) query.set('ma_npl', params.ma_npl);
  if (params.ma_sp) query.set('ma_sp', params.ma_sp);
  const suffix = query.toString();
  const res = await fetch(suffix ? `${PHIEU_NHAP_KHO_API}?${suffix}` : PHIEU_NHAP_KHO_API);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Không tải được phiếu nhập kho.');
  return data as { movements: unknown[]; total: number; source?: string };
}

export async function createPhieuNhapKho(payload: Record<string, unknown>) {
  const res = await fetch(PHIEU_NHAP_KHO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Không lưu được phiếu nhập kho.');
  return data as { success: boolean; slipCode: string; movements: unknown[] };
}

export async function updatePhieuNhapKho(slipCode: string, payload: Record<string, unknown>) {
  const res = await fetch(`${PHIEU_NHAP_KHO_API}/${encodeURIComponent(slipCode)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Không cập nhật được phiếu nhập kho.');
  return data as { success: boolean; slipCode: string; movements: unknown[] };
}

export async function deletePhieuNhapKho(slipCode: string) {
  const res = await fetch(`${PHIEU_NHAP_KHO_API}/slip/${encodeURIComponent(slipCode)}`, {
    method: 'DELETE'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Không xóa được phiếu nhập kho.');
  return data as { success: boolean; deletedCount: number };
}
