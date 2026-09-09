'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTabAccess } from '../../app/useTabAccess';
import { AlertTriangle, Loader2, Printer, Save, X } from 'lucide-react';
import { formatProductionNameWithLength } from '../_shared/productionProductHelpers';
import { isCuonProduct, isTamProduct } from '../_shared/orderHelpers';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';

interface PreviewRow {
  key: string;
  stt: number;
  ma_don_hang: string;
  san_pham_id: string | null;
  item_index: number;
  ten_sp: string;
  ten_san_xuat: string;
  don_vi: string;
  tong_sx: number;
  kg_cuon: number | null;
  tl_tam: number | null;
  slsx_bac: number;
  slsx_trung: number;
  slsx_nam: number;
  ghi_chu: string;
  has_saved_detail: boolean;
  khu_vuc?: string;
  quy_cach_m_dai?: number | null;
}

interface ComputedRow extends PreviewRow {
  bac: number;
  trung: number;
  nam: number;
  ghiChu: string;
  totalSlsx: number;
  overLimit: boolean;
  tongTl: number;
  productName: string;
}

interface RowEdit {
  bac: string;
  trung: string;
  nam: string;
  ghiChu: string;
}

const FIELD_CLASS =
  'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500';

const CELL_INPUT_CLASS =
  'h-7 w-full rounded-md border border-zinc-300 bg-white px-1.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/10 disabled:bg-zinc-100';

const NUM_INPUT_CLASS = `${CELL_INPUT_CLASS} text-right tabular-nums`;
const NUM_INPUT_ERROR_CLASS =
  'h-7 w-full rounded-md border border-rose-400 bg-rose-50 px-1.5 text-right text-xs font-bold tabular-nums text-rose-700 outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-200';

function formatNum(value: number | null): string {
  return value !== null && Number.isFinite(value) ? value.toFixed(2) : '—';
}

function formatPlanDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '—';
}

/** Đồng nhất với lệnh sản xuất: Tổng TL tính theo Tổng SX, không theo phần phân bổ vùng. */
function calculateTotalWeight(row: Pick<PreviewRow, 'don_vi' | 'kg_cuon' | 'tl_tam' | 'tong_sx'>) {
  if (isCuonProduct(row.don_vi)) return row.tong_sx * (row.kg_cuon ?? 0);
  if (isTamProduct(row.don_vi)) return row.tong_sx * (row.tl_tam ?? 0);
  return row.don_vi.trim().toLowerCase() === 'kg' ? row.tong_sx : 0;
}

export function splitProductNameAndNote(raw: string): { name: string; note: string } {
  if (!raw) return { name: '', note: '' };
  const notes: string[] = [];
  const name = raw
    .replace(/\(([^()]*)\)/g, (_match, inner: string) => {
      if (inner.trim()) notes.push(inner.trim());
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { name, note: notes.join('; ') };
}

export function ProductionPlanPrintPreviewModal({
  open,
  planId,
  onClose,
  onAfterSaveAndPrint
}: {
  open: boolean;
  planId: string;
  onClose: () => void;
  onAfterSaveAndPrint?: () => void;
}) {
  const { canEdit } = useTabAccess('production-plan-history');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [header, setHeader] = useState<{
    ma_ke_hoach: string;
    ngay_ke_hoach: string;
    ma_so: string;
    ngay_lien_lac: string;
    dac_ta: string;
  } | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [lanBanHanh, setLanBanHanh] = useState('01');
  const [edits, setEdits] = useState<
    Record<string, RowEdit>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !planId) return;

    const loadPreview = async () => {
      setLoading(true);
      setError('');
      setFormError('');
      try {
        const res = await fetch(`/api/ke-hoach-sx/${planId}/print-preview`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải xem trước.');
        }

        setHeader({
          ma_ke_hoach: data.plan.ma_ke_hoach || '',
          ngay_ke_hoach: data.plan.ngay_ke_hoach || '',
          ma_so: data.plan.ma_so || '',
          ngay_lien_lac: data.plan.ngay_lien_lac || '',
          dac_ta: data.plan.dac_ta || ''
        });
        setLanBanHanh(data.plan.lan_ban_hanh || '01');

        const rowsWithNames: PreviewRow[] = (data.rows || []).map((r: any, idx: number) => ({
          key: String(r.key || `${planId}__${idx + 1}`),
          stt: Number(r.stt) || idx + 1,
          ma_don_hang: String(r.ma_don_hang || '').trim(),
          san_pham_id: r.san_pham_id || null,
          item_index: Number(r.item_index) || idx,
          ten_sp: String(r.ten_sp || '').trim(),
          ten_san_xuat: formatProductionNameWithLength(
            String(r.ten_san_xuat || r.productionName || r.ten_sp || r.ten_hang || r.ten_san_pham || r.productName || '').trim(),
            Number(r.quy_cach_m_dai) > 0 ? Number(r.quy_cach_m_dai) : undefined
          ),
          don_vi: String(r.don_vi || '').trim(),
          slsx_bac: Number(r.slsx_bac) || 0,
          slsx_trung: Number(r.slsx_trung) || 0,
          slsx_nam: Number(r.slsx_nam) || 0,
          ghi_chu: r.ghi_chu || '',
          tong_sx: Number(r.tong_sx) || 0,
          kg_cuon: r.kg_cuon !== null ? Number(r.kg_cuon) : null,
          tl_tam: r.tl_tam !== null && r.tl_tam !== undefined ? Number(r.tl_tam) : null,
          has_saved_detail: Boolean(r.has_saved_detail),
          khu_vuc: String(r.khu_vuc || '').trim(),
          quy_cach_m_dai: Number(r.quy_cach_m_dai) > 0 ? Number(r.quy_cach_m_dai) : null
        }));

        setRows(rowsWithNames);

        const newEdits: typeof edits = {};
        rowsWithNames.forEach((row, idx) => {
          const editKey = `${row.key}-${idx}`;
          newEdits[editKey] = {
            bac: String(row.slsx_bac || 0),
            trung: String(row.slsx_trung || 0),
            nam: String(row.slsx_nam || 0),
            ghiChu: row.ghi_chu || ''
          };
        });
        setEdits(newEdits);
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải xem trước.');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [open, planId]);

  const computedRows: ComputedRow[] = useMemo(() => {
    return rows.map((row, idx) => {
      const editKey = `${row.key}-${idx}`;
      const edit = edits[editKey] ?? { bac: '0', trung: '0', nam: '0', ghiChu: '' };
      const bac = Math.max(0, Number(edit.bac) || 0);
      const trung = Math.max(0, Number(edit.trung) || 0);
      const nam = Math.max(0, Number(edit.nam) || 0);
      const totalSlsx = bac + trung + nam;
      const overLimit = totalSlsx > row.tong_sx + 0.0001;

      const tongTl = calculateTotalWeight(row);
      return {
        ...row,
        bac,
        trung,
        nam,
        ghiChu: edit.ghiChu || '',
        totalSlsx,
        overLimit,
        tongTl,
        productName: formatProductionNameWithLength(
          row.ten_san_xuat || row.ten_sp || '',
          row.quy_cach_m_dai ?? undefined
        )
      };
    });
  }, [rows, edits]);

  const hasValidationError = computedRows.some(r => r.overLimit);

  function updateEdit(editKey: string, patch: Partial<RowEdit>) {
    setEdits(prev => ({
      ...prev,
      [editKey]: { ...(prev[editKey] ?? { bac: '0', trung: '0', nam: '0', ghiChu: '' }), ...patch }
    }));
  }

  async function handleSave(): Promise<boolean> {
    setFormError('');
    if (hasValidationError) {
      setFormError('Có dòng vượt quá Tổng SX. Vui lòng kiểm tra lại trước khi lưu.');
      return false;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/ke-hoach-sx/${planId}/print-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ma_so: header?.ma_so || '',
          ngay_lien_lac: header?.ngay_lien_lac || '',
          dac_ta: header?.dac_ta || '',
          lan_ban_hanh: lanBanHanh,
          rows: computedRows.map(r => ({
            ma_don_hang: r.ma_don_hang,
            san_pham_id: r.san_pham_id,
            item_index: r.item_index,
            ten_san_xuat: r.productName,
            slsx_bac: r.bac,
            slsx_trung: r.trung,
            slsx_nam: r.nam,
            ghi_chu: r.ghiChu,
            khu_vuc: r.khu_vuc,
            thu_tu: r.stt
          }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu preview.');
      return true;
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu preview.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAndPrint() {
    const ok = await handleSave();
    if (ok) {
      onAfterSaveAndPrint?.();
    }
  }


  if (!open) return null;

  const overLimitCount = computedRows.filter(row => row.overLimit).length;
  const numHeadCell = 'whitespace-nowrap px-2.5 py-2.5 text-center font-bold';
  const textHeadCell = 'whitespace-nowrap px-2.5 py-2.5 text-left font-bold';
  const bodyCell = 'border-b border-zinc-200 px-2.5 py-1.5 align-middle';

  return createPortal(
    <div className="production-order-preview-print-root fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="production-order-preview-print-frame flex h-[100dvh] w-full max-w-[1400px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[94dvh] sm:rounded-2xl">
        <div className="production-order-preview-noprint flex items-center justify-between gap-3 bg-zinc-950 px-5 py-3.5 text-white">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Xem trước khi in</div>
            <div className="truncate text-base font-black">Kế hoạch sản xuất {header?.ma_ke_hoach || '—'}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="production-order-preview-noprint border-b border-zinc-200 bg-zinc-50 px-5 py-4">
          <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-zinc-500">Thông tin biểu mẫu</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Mã số</label>
              <input
                type="text"
                value={header?.ma_so || ''}
                disabled={!canEdit}
                onChange={event => setHeader(current => current ? { ...current, ma_so: event.target.value } : current)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Lần ban hành</label>
              <input
                type="text"
                value={lanBanHanh}
                disabled={!canEdit}
                onChange={event => setLanBanHanh(event.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">Ngày liên lạc</label>
              <input
                type="date"
                value={header?.ngay_lien_lac || ''}
                disabled={!canEdit}
                onChange={event => setHeader(current => current ? { ...current, ngay_lien_lac: event.target.value } : current)}
                className={FIELD_CLASS}
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Đặc tả
                <span className="ml-1 font-normal normal-case text-zinc-400">(Ví dụ Số 1: 22 / 7 / 2026 / ĐẶC1)</span>
              </label>
              <textarea
                value={header?.dac_ta || ''}
                disabled={!canEdit}
                onChange={event => setHeader(current => current ? { ...current, dac_ta: event.target.value } : current)}
                rows={2}
                className={`${FIELD_CLASS} h-auto min-h-[3.75rem] resize-y py-2 leading-snug`}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="production-order-preview-noprint flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-100">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-500">Đang tải xem trước…</span>
          </div>
        )}

        {!loading && !error && (
          <div className="production-order-preview-print-sheet flex-1 overflow-auto print:overflow-visible">
            <div className="hidden print:block">
              <div className="flex min-h-16 items-center justify-between border-b border-gray-300 p-2">
                <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="h-12 w-auto object-contain" />
                <div className="flex-1 text-center">
                  <div className="text-[10px] font-semibold uppercase">{PRINT_COMPANY_NAME}</div>
                  <div className="text-sm font-bold">KẾ HOẠCH SẢN XUẤT</div>
                  <div className="text-[10px]">
                    Số: {header?.ma_ke_hoach || '-'} &nbsp;·&nbsp; Ngày: {formatPlanDate(header?.ngay_ke_hoach || '')}
                  </div>
                </div>
                <div className="text-left text-[10px]">
                  <div>Mã số: {header?.ma_so || '—'}</div>
                  <div>Lần ban hành: {lanBanHanh || '—'}</div>
                  <div>Ngày liên lạc: {formatPlanDate(header?.ngay_lien_lac || '')}</div>
                </div>
              </div>
              {header?.dac_ta && (
                <div className="whitespace-pre-wrap break-words border-b border-gray-300 px-2 py-1 text-[10px]">{header.dac_ta}</div>
              )}
            </div>

            <div className="production-order-preview-print-body bg-zinc-100 p-4 sm:p-6 print:bg-transparent print:p-0">
              <div className="mx-auto max-w-[1400px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
                <div className="overflow-x-auto print:overflow-hidden">
                  <table className="w-full border-collapse text-xs print:[&_td]:border print:[&_td]:border-gray-400 print:[&_th]:border print:[&_th]:border-gray-400">
                    <thead className="sticky top-0 z-10 bg-zinc-950 text-[10px] uppercase tracking-wide text-white print:static print:bg-gray-100 print:text-black">
                      <tr>
                        <th className={`${numHeadCell} w-10`}>STT</th>
                        <th className={`${textHeadCell} min-w-28`}>Mã đơn hàng</th>
                        <th className={`${textHeadCell} min-w-40`}>Tên sản xuất</th>
                        <th className={`${textHeadCell} min-w-48`}>Ghi chú</th>
                        <th className={`${numHeadCell} w-14`}>ĐVT</th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16`}><span className="block leading-tight">Tồn</span><span className="block leading-tight">kho</span></th>
                        <th className={`${numHeadCell} production-order-preview-th-nowrap w-16`}>TL/cuộn</th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16`}><span className="block leading-tight">Tổng</span><span className="block leading-tight">SX</span></th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16 bg-zinc-900 print:bg-gray-100`}><span className="block leading-tight">SLSX</span><span className="block leading-tight">Bắc</span></th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16 bg-zinc-900 print:bg-gray-100`}><span className="block leading-tight">SLSX</span><span className="block leading-tight">Trung</span></th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16 bg-zinc-900 print:bg-gray-100`}><span className="block leading-tight">SLSX</span><span className="block leading-tight">Nam</span></th>
                        <th className={`${numHeadCell} w-14`}>TL/Tấm</th>
                        <th className={`${numHeadCell} w-16`}>Tổng TL</th>
                        <th className={`${numHeadCell} production-order-preview-th-stack w-16`}><span className="block leading-tight">Thực tế</span><span className="block leading-tight">SX</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedRows.length === 0 ? (
                        <tr><td colSpan={14} className="px-4 py-10 text-center text-sm font-semibold text-zinc-400">Kế hoạch sản xuất chưa có dòng sản phẩm.</td></tr>
                      ) : computedRows.map((row, rowIdx) => {
                        const editKey = `${row.key}-${rowIdx}`;
                        return (
                          <tr key={editKey} className={`transition-colors ${row.overLimit ? 'bg-rose-50' : 'hover:bg-zinc-50'}`}>
                            <td className={`${bodyCell} text-center font-bold text-zinc-500`}>{row.stt}</td>
                            <td className={`${bodyCell} whitespace-nowrap font-bold text-zinc-700`}>{row.ma_don_hang || '—'}</td>
                            <td className={`${bodyCell} break-words font-semibold text-zinc-900`}>{row.productName || row.ten_sp || '—'}</td>
                            <td className={bodyCell}>
                              <input type="text" value={edits[editKey]?.ghiChu ?? ''} onChange={event => updateEdit(editKey, { ghiChu: event.target.value })} className={CELL_INPUT_CLASS} />
                            </td>
                            <td className={`${bodyCell} text-center text-zinc-700`}>{row.don_vi || '—'}</td>
                            <td className={`${bodyCell} bg-zinc-50/60 print:bg-transparent`} />
                            <td className={`${bodyCell} text-right tabular-nums text-zinc-700`}>{isCuonProduct(row.don_vi) ? formatNum(row.kg_cuon) : '—'}</td>
                            <td className={`${bodyCell} text-right font-bold tabular-nums text-zinc-900`}>{row.tong_sx.toFixed(2)}</td>
                            <td className={bodyCell}><input type="number" min="0" step="any" value={edits[editKey]?.bac ?? '0'} onChange={event => updateEdit(editKey, { bac: event.target.value })} className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS} /></td>
                            <td className={bodyCell}><input type="number" min="0" step="any" value={edits[editKey]?.trung ?? '0'} onChange={event => updateEdit(editKey, { trung: event.target.value })} className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS} /></td>
                            <td className={bodyCell}><input type="number" min="0" step="any" value={edits[editKey]?.nam ?? '0'} onChange={event => updateEdit(editKey, { nam: event.target.value })} className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS} /></td>
                            <td className={`${bodyCell} text-right tabular-nums text-zinc-700`}>{isTamProduct(row.don_vi) ? formatNum(row.tl_tam) : '—'}</td>
                            <td className={`${bodyCell} text-right font-bold tabular-nums text-zinc-900`}>{row.tongTl.toFixed(2)}</td>
                            <td className={`${bodyCell} bg-zinc-50/60 print:bg-transparent`} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {computedRows.length > 0 && (
                <div className="production-order-preview-noprint mx-auto mt-3 max-w-[1400px]">
                  {hasValidationError ? (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{overLimitCount} dòng có tổng SL.SX (Bắc + Trung + Nam) vượt quá Tổng SX.</p>
                  ) : (
                    <p className="text-xs text-zinc-500">Tổng SL.SX (Bắc + Trung + Nam) của mỗi dòng không được vượt quá Tổng SX.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && formError && (
          <div className="production-order-preview-noprint flex items-center gap-2 border-t border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />{formError}
          </div>
        )}

        {!loading && !error && (
          <div className="production-order-preview-noprint flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-zinc-200 bg-white px-5 py-3">
            <div className="hidden text-xs font-semibold text-zinc-500 sm:block">{computedRows.length > 0 ? `${computedRows.length} dòng sản phẩm` : ''}</div>
            <div className="flex flex-1 justify-end gap-2 sm:flex-none">
              <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50">Đóng</button>
              {canEdit && (
                <>
                  <button type="button" onClick={() => handleSave()} disabled={isSaving || hasValidationError} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-extrabold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu
                  </button>
                  <button type="button" onClick={() => handleSaveAndPrint()} disabled={isSaving || hasValidationError} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Lưu &amp; In
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
