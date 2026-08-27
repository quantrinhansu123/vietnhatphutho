'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header (non-print) */}
        <div className="border-b border-gray-200 p-4 bg-gray-50 production-order-preview-noprint">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Xem trước khi in</h2>
            <button type="button" onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block font-medium text-gray-700">Mã số</label>
              <input
                type="text"
                value={meta.ma_so}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, ma_so: e.target.value }))}
                className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Ngày liên lạc</label>
              <input
                type="date"
                value={meta.ngay_lien_lac}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, ngay_lien_lac: e.target.value }))}
                className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700">Lần ban hành</label>
              <input
                type="text"
                value={meta.lan_ban_hanh}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, lan_ban_hanh: e.target.value }))}
                className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-medium text-gray-700">Đặc tả (Ví dụ Số 1: 22 / 7 / 2026 / ĐẶC1)</label>
              <textarea
                value={meta.dac_ta}
                disabled={!canEdit}
                onChange={e => setMeta(prev => ({ ...prev, dac_ta: e.target.value }))}
                rows={2}
                className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-100 border-b border-red-300 px-4 py-2 text-sm text-red-700 production-order-preview-noprint">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        {/* Main content */}
        {!loading && !error && (
          <div className="flex-1 overflow-auto production-order-preview-print-sheet">
            {/* Print-only header */}
            <div className="hidden print:block mb-0">
              <div className="flex items-center justify-between p-2 border-b border-gray-300 min-h-16">
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
                <div className="px-2 py-1 text-[10px] border-b border-gray-300 whitespace-pre-wrap break-words">
                  {meta.dac_ta}
                </div>
              )}
            </div>

            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-8">STT</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-left font-semibold min-w-20">Tên sản xuất</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-left font-semibold min-w-48">Ghi chú</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-12">ĐVT</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-12">Tồn kho</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">Kg/cuộn</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">Tổng SX</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">SL.SX Bắc</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">SL.SX Trung</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">SL.SX Nam</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-12">TL/Tấm</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">Tổng TL</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-14">Thực tế SX</th>
                </tr>
              </thead>
              <tbody>
                {computedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="border border-gray-300 px-2 py-3 text-center text-gray-500">
                      Lệnh sản xuất chưa có dòng sản phẩm.
                    </td>
                  </tr>
                ) : (
                  computedRows.map((row, rowIdx) => {
                    const editKey = `${row.key}-${rowIdx}`;
                    return (
                      <tr key={editKey} className={row.overLimit ? 'bg-red-50' : ''}>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-medium">{row.stt}</td>
                        <td className="border border-gray-300 px-1 py-0.5 whitespace-normal break-words min-w-20">
                          {row.productName}
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 min-w-48">
                          <input
                            type="text"
                            value={edits[editKey]?.ghiChu ?? ''}
                            onChange={e => updateEdit(editKey, { ghiChu: e.target.value })}
                            className="w-full px-0.5 py-0.5 border rounded text-xs"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center">{row.don_vi || '—'}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center" />
                        <td className="border border-gray-300 px-1 py-0.5 text-center">{formatNum(row.kg_cuon)}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-medium">
                          {row.so_luong.toFixed(2)}
                        </td>
                        <td className={`border border-gray-300 px-1 py-0.5 text-center ${row.overLimit ? 'border-red-500' : ''}`}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={edits[editKey]?.bac ?? '0'}
                            onChange={e => updateEdit(editKey, { bac: e.target.value })}
                            className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                              row.overLimit ? 'border-red-500 bg-red-50' : ''
                            }`}
                          />
                        </td>
                        <td className={`border border-gray-300 px-1 py-0.5 text-center ${row.overLimit ? 'border-red-500' : ''}`}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={edits[editKey]?.trung ?? '0'}
                            onChange={e => updateEdit(editKey, { trung: e.target.value })}
                            className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                              row.overLimit ? 'border-red-500 bg-red-50' : ''
                            }`}
                          />
                        </td>
                        <td className={`border border-gray-300 px-1 py-0.5 text-center ${row.overLimit ? 'border-red-500' : ''}`}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={edits[editKey]?.nam ?? '0'}
                            onChange={e => updateEdit(editKey, { nam: e.target.value })}
                            className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                              row.overLimit ? 'border-red-500 bg-red-50' : ''
                            }`}
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center">{formatNum(row.tl_tam)}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center font-medium">
                          {row.tongTl.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-1 py-0.5 text-center h-7" />
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Toolbar (non-print) */}
        {!loading && !error && (
          <div className="border-t border-gray-200 bg-gray-50 p-3 production-order-preview-noprint">
            {formError && (
              <div className="bg-red-100 border border-red-300 text-red-700 text-sm px-3 py-2 rounded mb-3">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium"
              >
                Đóng
              </button>
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={isSaving || hasValidationError}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndPrint()}
                    disabled={isSaving || hasValidationError}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Lưu & In
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
