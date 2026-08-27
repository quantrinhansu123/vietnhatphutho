'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Printer, Save, X } from 'lucide-react';
import {
  formatProductionOrderPrintDate,
  type ProductionOrderRow
} from '../ke-hoach-san-xuat';
import { splitProductNameAndNote } from '../ke-hoach-san-xuat/PrintPreviewModal';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';
import { waitForPrintImagesReady } from '../../utils/printReady';

interface ProductionOrderPrintMeta {
  ma_so: string;
  ngay_lien_lac: string;
  dac_ta: string;
  lan_ban_hanh: string;
}

interface PreviewRow {
  key: string;
  stt: number;
  item_index: number;
  ma_sp: string;
  ten_sp: string;
  ten_san_xuat: string;
  don_vi: string;
  so_luong: number;
  khu_vuc: string;
  slsx_bac: number;
  slsx_trung: number;
  slsx_nam: number;
  kg_cuon: number | null;
  tl_tam: number | null;
  ghi_chu: string;
  has_saved_detail: boolean;
}

interface RowEdit {
  bac: string;
  trung: string;
  nam: string;
  ghiChu: string;
}

const EMPTY_META: ProductionOrderPrintMeta = { ma_so: '', ngay_lien_lac: '', dac_ta: '', lan_ban_hanh: '01' };

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

export function ProductionOrderPrintPreviewModal({
  open,
  order,
  canEdit = true,
  onClose
}: {
  open: boolean;
  order: ProductionOrderRow | null;
  staffMap?: Map<string, string>;
  canEdit?: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [meta, setMeta] = useState<ProductionOrderPrintMeta>(EMPTY_META);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  useEffect(() => {
    if (!open || !order) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setFormError('');
    setMeta(EMPTY_META);
    setRows([]);
    setEdits({});

    fetch(`/api/lenh-sx/${order.id}/print-preview`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể tải xem trước.');
        return data;
      })
      .then(previewData => {
        if (cancelled) return;
        setMeta({
          ma_so: previewData.plan?.ma_so || '',
          ngay_lien_lac: previewData.plan?.ngay_lien_lac || '',
          dac_ta: previewData.plan?.dac_ta || '',
          lan_ban_hanh: previewData.plan?.lan_ban_hanh || '01'
        });
        const previewRows: PreviewRow[] = (previewData.rows || []).map((r: any, idx: number) => ({
          key: String(r.key || `${order.id}__${idx + 1}`),
          stt: Number(r.stt) || idx + 1,
          item_index: Number(r.item_index) || idx,
          ma_sp: r.ma_sp || '',
          ten_sp: r.ten_sp || '',
          ten_san_xuat: r.ten_san_xuat || r.ten_sp || '',
          don_vi: r.don_vi || '',
          so_luong: Number(r.so_luong) || 0,
          khu_vuc: r.khu_vuc || '',
          slsx_bac: Number(r.slsx_bac) || 0,
          slsx_trung: Number(r.slsx_trung) || 0,
          slsx_nam: Number(r.slsx_nam) || 0,
          kg_cuon: r.kg_cuon !== null && r.kg_cuon !== undefined ? Number(r.kg_cuon) : null,
          tl_tam: r.tl_tam !== null && r.tl_tam !== undefined ? Number(r.tl_tam) : null,
          ghi_chu: r.ghi_chu || '',
          has_saved_detail: Boolean(r.has_saved_detail)
        }));
        setRows(previewRows);
        const seededEdits: Record<string, RowEdit> = {};
        previewRows.forEach((row, idx) => {
          seededEdits[`${row.key}-${idx}`] = {
            bac: String(row.slsx_bac || 0),
            trung: String(row.slsx_trung || 0),
            nam: String(row.slsx_nam || 0),
            ghiChu: row.ghi_chu || ''
          };
        });
        setEdits(seededEdits);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Lỗi khi tải xem trước.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, order?.id]);

  const computedRows = useMemo(() => {
    return rows.map((row, idx) => {
      const edit = edits[`${row.key}-${idx}`] ?? { bac: '0', trung: '0', nam: '0', ghiChu: '' };
      const bac = Math.max(0, Number(edit.bac) || 0);
      const trung = Math.max(0, Number(edit.trung) || 0);
      const nam = Math.max(0, Number(edit.nam) || 0);
      const totalSlsx = bac + trung + nam;
      const overLimit = totalSlsx > row.so_luong + 0.0001;

      const unit = row.don_vi.trim().toLowerCase();
      let tongTl = 0;
      if (unit === 'cuộn') {
        tongTl = totalSlsx * (row.kg_cuon || 0);
      } else if (unit === 'tấm') {
        tongTl = totalSlsx * (row.tl_tam || 0);
      } else if (unit === 'kg') {
        tongTl = totalSlsx;
      }

      const { name } = splitProductNameAndNote(row.ten_san_xuat);

      return {
        ...row,
        bac,
        trung,
        nam,
        ghiChu: edit.ghiChu || '',
        totalSlsx,
        overLimit,
        tongTl,
        productName: name || row.ten_san_xuat || row.ten_sp || '-'
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

  useEffect(() => {
    if (!pendingPrint) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (!cancelled) window.print();
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingPrint]);

  useEffect(() => {
    const handleAfterPrint = () => setPendingPrint(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  async function handleSave(): Promise<boolean> {
    if (!order) return false;
    setFormError('');
    if (hasValidationError) {
      setFormError('Có dòng vượt quá Tổng SX. Vui lòng kiểm tra lại trước khi lưu.');
      return false;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/lenh-sx/${order.id}/print-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          rows: computedRows.map(r => ({
            item_index: r.item_index,
            slsx_bac: r.bac,
            slsx_trung: r.trung,
            slsx_nam: r.nam,
            ghi_chu: r.ghiChu
          }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu.');
      return true;
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAndPrint() {
    const ok = await handleSave();
    if (ok) setPendingPrint(true);
  }

  if (!open || !order) return null;

  const printDate = formatProductionOrderPrintDate(order.startDate);
  const overLimitCount = computedRows.filter(r => r.overLimit).length;

  const numHeadCell = 'whitespace-nowrap px-2.5 py-2.5 text-center font-bold';
  const textHeadCell = 'whitespace-nowrap px-2.5 py-2.5 text-left font-bold';
  const bodyCell = 'border-b border-zinc-200 px-2.5 py-1.5 align-middle';

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-[1400px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[94dvh] sm:rounded-2xl">
        {/* Header (non-print) */}
        <div className="production-order-preview-noprint flex items-center justify-between gap-3 bg-zinc-950 px-5 py-3.5 text-white">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Xem trước khi in
            </div>
            <div className="truncate text-base font-black">
              Lệnh sản xuất {order.code || '—'}
            </div>
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

        {/* Meta form (non-print) */}
        <div className="production-order-preview-noprint border-b border-zinc-200 bg-zinc-50 px-5 py-4">
          <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-zinc-500">
            Thông tin biểu mẫu
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Mã số
              </label>
              <input
                type="text"
                value={meta.ma_so}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, ma_so: e.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Lần ban hành
              </label>
              <input
                type="text"
                value={meta.lan_ban_hanh}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, lan_ban_hanh: e.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Ngày liên lạc
              </label>
              <input
                type="date"
                value={meta.ngay_lien_lac}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, ngay_lien_lac: e.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Đặc tả
                <span className="ml-1 font-normal normal-case text-zinc-400">
                  (Ví dụ Số 1: 22 / 7 / 2026 / ĐẶC1)
                </span>
              </label>
              <textarea
                value={meta.dac_ta}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, dac_ta: e.target.value }))}
                rows={2}
                className={`${FIELD_CLASS} h-auto min-h-[3.75rem] resize-y py-2 leading-snug`}
              />
            </div>
          </div>
        </div>

        {/* Error banner (non-print) */}
        {error && (
          <div className="production-order-preview-noprint flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-100">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-500">Đang tải xem trước…</span>
          </div>
        )}

        {/* Main content */}
        {!loading && !error && (
          <div className="production-order-preview-print-sheet flex-1 overflow-auto print:overflow-visible">
            {/* Print-only header */}
            <div className="hidden print:block">
              <div className="flex min-h-16 items-center justify-between border-b border-gray-300 p-2">
                <img
                  src={vietNhatLogoUrl}
                  alt={PRINT_COMPANY_NAME}
                  className="h-12 w-auto object-contain"
                />
                <div className="flex-1 text-center">
                  <div className="text-[10px] font-semibold uppercase">{PRINT_COMPANY_NAME}</div>
                  <div className="text-sm font-bold">LỆNH SẢN XUẤT</div>
                  <div className="text-[10px]">
                    Số: {order.code || '-'} &nbsp;·&nbsp; Ngày: {printDate}
                  </div>
                </div>
                <div className="text-left text-[10px]">
                  <div>Mã số: {meta.ma_so || '—'}</div>
                  <div>Lần ban hành: {meta.lan_ban_hanh || '—'}</div>
                  <div>Ngày liên lạc: {meta.ngay_lien_lac || '—'}</div>
                </div>
              </div>
              {meta.dac_ta && (
                <div className="whitespace-pre-wrap break-words border-b border-gray-300 px-2 py-1 text-[10px]">
                  {meta.dac_ta}
                </div>
              )}
            </div>

            {/* Screen wrapper */}
            <div className="min-h-full bg-zinc-100 p-4 print:bg-transparent print:p-0 sm:p-6">
              <div className="mx-auto max-w-[1400px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full border-collapse text-xs print:[&_td]:border print:[&_td]:border-gray-400 print:[&_th]:border print:[&_th]:border-gray-400">
                    <thead className="sticky top-0 z-10 bg-zinc-950 text-[10px] uppercase tracking-wide text-white print:static print:bg-gray-100 print:text-black">
                      <tr>
                        <th className={`${numHeadCell} w-10`}>STT</th>
                        <th className={`${textHeadCell} min-w-40`}>Tên sản xuất</th>
                        <th className={`${textHeadCell} min-w-48`}>Ghi chú</th>
                        <th className={`${numHeadCell} w-14`}>ĐVT</th>
                        <th className={`${numHeadCell} w-16`}>Tồn kho</th>
                        <th className={`${numHeadCell} w-16`}>Kg/cuộn</th>
                        <th className={`${numHeadCell} w-16`}>Tổng SX</th>
                        <th className={`${numHeadCell} w-20 bg-zinc-900 print:bg-gray-100`}>SL.SX Bắc</th>
                        <th className={`${numHeadCell} w-20 bg-zinc-900 print:bg-gray-100`}>SL.SX Trung</th>
                        <th className={`${numHeadCell} w-20 bg-zinc-900 print:bg-gray-100`}>SL.SX Nam</th>
                        <th className={`${numHeadCell} w-14`}>TL/Tấm</th>
                        <th className={`${numHeadCell} w-16`}>Tổng TL</th>
                        <th className={`${numHeadCell} w-16`}>Thực tế SX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={13}
                            className="px-4 py-10 text-center text-sm font-semibold text-zinc-400"
                          >
                            Lệnh sản xuất chưa có dòng sản phẩm.
                          </td>
                        </tr>
                      ) : (
                        computedRows.map((row, rowIdx) => {
                          const editKey = `${row.key}-${rowIdx}`;
                          return (
                            <tr
                              key={editKey}
                              className={`transition-colors ${
                                row.overLimit ? 'bg-rose-50' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <td className={`${bodyCell} text-center font-bold text-zinc-500`}>
                                {row.stt}
                              </td>
                              <td className={`${bodyCell} break-words font-semibold text-zinc-900`}>
                                {row.productName}
                              </td>
                              <td className={bodyCell}>
                                <input
                                  type="text"
                                  value={edits[editKey]?.ghiChu ?? ''}
                                  onChange={e => updateEdit(editKey, { ghiChu: e.target.value })}
                                  className={CELL_INPUT_CLASS}
                                />
                              </td>
                              <td className={`${bodyCell} text-center text-zinc-700`}>
                                {row.don_vi || '—'}
                              </td>
                              <td className={`${bodyCell} bg-zinc-50/60 print:bg-transparent`} />
                              <td className={`${bodyCell} text-right tabular-nums text-zinc-700`}>
                                {formatNum(row.kg_cuon)}
                              </td>
                              <td className={`${bodyCell} text-right font-bold tabular-nums text-zinc-900`}>
                                {row.so_luong.toFixed(2)}
                              </td>
                              <td className={bodyCell}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={edits[editKey]?.bac ?? '0'}
                                  onChange={e => updateEdit(editKey, { bac: e.target.value })}
                                  className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS}
                                />
                              </td>
                              <td className={bodyCell}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={edits[editKey]?.trung ?? '0'}
                                  onChange={e => updateEdit(editKey, { trung: e.target.value })}
                                  className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS}
                                />
                              </td>
                              <td className={bodyCell}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={edits[editKey]?.nam ?? '0'}
                                  onChange={e => updateEdit(editKey, { nam: e.target.value })}
                                  className={row.overLimit ? NUM_INPUT_ERROR_CLASS : NUM_INPUT_CLASS}
                                />
                              </td>
                              <td className={`${bodyCell} text-right tabular-nums text-zinc-700`}>
                                {formatNum(row.tl_tam)}
                              </td>
                              <td className={`${bodyCell} text-right font-bold tabular-nums text-zinc-900`}>
                                {row.tongTl.toFixed(2)}
                              </td>
                              <td className={`${bodyCell} bg-zinc-50/60 print:bg-transparent`} />
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {computedRows.length > 0 && (
                <div className="mx-auto mt-3 max-w-[1400px] print:hidden">
                  {hasValidationError ? (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {overLimitCount} dòng có tổng SL.SX (Bắc + Trung + Nam) vượt quá Tổng SX.
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Tổng SL.SX (Bắc + Trung + Nam) của mỗi dòng không được vượt quá Tổng SX.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save error (non-print) */}
        {!loading && !error && formError && (
          <div className="production-order-preview-noprint flex items-center gap-2 border-t border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {/* Toolbar (non-print) */}
        {!loading && !error && (
          <div className="production-order-preview-noprint flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-zinc-200 bg-white px-5 py-3">
            <div className="hidden text-xs font-semibold text-zinc-500 sm:block">
              {computedRows.length > 0 ? `${computedRows.length} dòng sản phẩm` : ''}
            </div>
            <div className="flex flex-1 justify-end gap-2 sm:flex-none">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={isSaving || hasValidationError}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-extrabold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndPrint()}
                    disabled={isSaving || hasValidationError}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Lưu &amp; In
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
