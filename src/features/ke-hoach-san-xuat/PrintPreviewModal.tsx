'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTabAccess } from '../../app/useTabAccess';
import { Loader2, X } from 'lucide-react';
import { waitForPrintImagesReady } from '../../utils/printReady';

interface PreviewRow {
  key: string;
  stt: number;
  ma_don_hang: string;
  san_pham_id: string | null;
  item_index: number;
  ten_sp: string;
  ten_san_xuat_raw: string;
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
  noteFromName: string;
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
    Record<string, { bac: string; trung: string; nam: string; ghiChu: string }>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);

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

        const rowsWithNames: PreviewRow[] = (data.rows || []).map((r: any) => ({
          ...r,
          slsx_bac: Number(r.slsx_bac) || 0,
          slsx_trung: Number(r.slsx_trung) || 0,
          slsx_nam: Number(r.slsx_nam) || 0,
          ghi_chu: r.ghi_chu || '',
          tong_sx: Number(r.tong_sx) || 0,
          kg_cuon: r.kg_cuon !== null ? Number(r.kg_cuon) : null,
          tl_tam: r.tl_tam !== null ? Number(r.tl_tam) : null
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

      let tongTl = 0;
      if (row.don_vi === 'Cuộn' || row.don_vi === 'cuộn') {
        tongTl = totalSlsx * (row.kg_cuon || 0);
      } else if (row.don_vi === 'Tấm' || row.don_vi === 'tấm') {
        tongTl = totalSlsx * (row.tl_tam || 0);
      } else if (row.don_vi === 'kg' || row.don_vi === 'Kg' || row.don_vi === 'KG') {
        tongTl = totalSlsx;
      }

      const { name, note } = splitProductNameAndNote(row.ten_san_xuat_raw);

      return {
        ...row,
        bac,
        trung,
        nam,
        ghiChu: edit.ghiChu || '',
        totalSlsx,
        overLimit,
        tongTl,
        productName: name,
        noteFromName: note
      };
    });
  }, [rows, edits]);

  const hasValidationError = computedRows.some(r => r.overLimit);

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
      setPendingPrint(true);
      onAfterSaveAndPrint?.();
    }
  }

  useEffect(() => {
    if (!pendingPrint) return;
    waitForPrintImagesReady().then(() => {
      window.print();
      setPendingPrint(false);
    });
  }, [pendingPrint]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header (non-print) */}
        <div className="border-b border-gray-200 p-4 bg-gray-50 production-plan-preview-noprint">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Xem trước khi in</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block font-medium text-gray-700">Mã số</label>
              <div className="text-gray-600">{header?.ma_so || '—'}</div>
            </div>
            <div>
              <label className="block font-medium text-gray-700">Ngày liên lạc</label>
              <div className="text-gray-600">{header?.ngay_lien_lac || '—'}</div>
            </div>
            <div className="col-span-2">
              <label className="block font-medium text-gray-700">Đặc tả</label>
              <div className="text-gray-600 text-xs whitespace-pre-wrap break-words">
                {header?.dac_ta || '—'}
              </div>
            </div>
            <div>
              <label className="block font-medium text-gray-700">Lần ban hành</label>
              <input
                type="text"
                value={lanBanHanh}
                onChange={e => setLanBanHanh(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-100 border-b border-red-300 px-4 py-2 text-sm text-red-700 production-plan-preview-noprint">
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
          <div className="flex-1 overflow-auto production-plan-preview-print-sheet">
            {/* Header - Show only when printing */}
            <div className="hidden print:block  mb-0">
              <div className="flex items-center justify-between p-2 border-b border-gray-300 min-h-16">
                <div className="w-12 h-12">
                  <img src="/icon-maskable-512.png" alt="VIETNHATIPT" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 text-center">
                  <div className="text-sm font-bold">KỀ HOẠCH SẢN XUẤT</div>
                </div>
                <div className="text-left">
                  <div className="text-xs inline-block p-1">
                    <div className="text-[10px]">Mã số: {header?.ma_so || '—'}</div>
                    <div className="text-[10px]">Lần ban hành: {lanBanHanh}</div>
                    <div className="text-[10px]">Ngày liên lạc: {header?.ngay_lien_lac || '—'}</div>
                  </div>
                </div>
              </div>
              <div className="px-2 py-1 text-xs border-b border-gray-300">
                 {header?.dac_ta || ''}
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border border-gray-300 px-1 py-0.5 text-center font-semibold w-8">STT</th>
                  <th className="border border-gray-300 px-1 py-0.5 text-left font-semibold min-w-20">Sản Phẩm</th>
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
                {computedRows.map((row, rowIdx) => (
                  <tr key={`${row.key}-${rowIdx}`} className={row.overLimit ? 'bg-red-50' : ''}>
                    <td className="border border-gray-300 px-1 py-0.5 text-center font-medium text-xs w-8">
                      {row.stt}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-xs whitespace-normal break-words min-w-20">
                      {row.productName}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-xs min-w-48">
                      <input
                        type="text"
                        key={`${row.key}-${rowIdx}-input`}
                        value={edits[`${row.key}-${rowIdx}`]?.ghiChu || ''}
                        onChange={e => {
                          const editKey = `${row.key}-${rowIdx}`;
                          const newEdits = { ...edits };
                          if (!newEdits[editKey]) {
                            newEdits[editKey] = { bac: '0', trung: '0', nam: '0', ghiChu: '' };
                          }
                          newEdits[editKey].ghiChu = e.target.value;
                          setEdits(newEdits);
                        }}
                        className="w-full px-0.5 py-0.5 border rounded text-xs"
                      />
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs w-12">
                      {row.don_vi}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs w-12" />
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs w-14">
                      {row.kg_cuon !== null ? row.kg_cuon.toFixed(2) : '—'}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs font-medium w-14">
                      {row.tong_sx.toFixed(2)}
                    </td>
                    <td
                      className={`border border-gray-300 px-1 py-0.5 text-center text-xs w-14 ${
                        row.overLimit ? 'border-red-500' : ''
                      }`}
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        key={`${row.key}-${rowIdx}-bac`}
                        value={edits[`${row.key}-${rowIdx}`]?.bac || '0'}
                        onChange={e => {
                          const editKey = `${row.key}-${rowIdx}`;
                          const newEdits = { ...edits };
                          if (!newEdits[editKey]) {
                            newEdits[editKey] = { bac: '0', trung: '0', nam: '0', ghiChu: '' };
                          }
                          newEdits[editKey].bac = e.target.value;
                          setEdits(newEdits);
                        }}
                        className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                          row.overLimit ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                    </td>
                    <td
                      className={`border border-gray-300 px-1 py-0.5 text-center text-xs w-14 ${
                        row.overLimit ? 'border-red-500' : ''
                      }`}
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        key={`${row.key}-${rowIdx}-trung`}
                        value={edits[`${row.key}-${rowIdx}`]?.trung || '0'}
                        onChange={e => {
                          const editKey = `${row.key}-${rowIdx}`;
                          const newEdits = { ...edits };
                          if (!newEdits[editKey]) {
                            newEdits[editKey] = { bac: '0', trung: '0', nam: '0', ghiChu: '' };
                          }
                          newEdits[editKey].trung = e.target.value;
                          setEdits(newEdits);
                        }}
                        className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                          row.overLimit ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                    </td>
                    <td
                      className={`border border-gray-300 px-1 py-0.5 text-center text-xs w-14 ${
                        row.overLimit ? 'border-red-500' : ''
                      }`}
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        key={`${row.key}-${rowIdx}-nam`}
                        value={edits[`${row.key}-${rowIdx}`]?.nam || '0'}
                        onChange={e => {
                          const editKey = `${row.key}-${rowIdx}`;
                          const newEdits = { ...edits };
                          if (!newEdits[editKey]) {
                            newEdits[editKey] = { bac: '0', trung: '0', nam: '0', ghiChu: '' };
                          }
                          newEdits[editKey].nam = e.target.value;
                          setEdits(newEdits);
                        }}
                        className={`w-full px-0.5 py-0.5 border rounded text-xs text-center ${
                          row.overLimit ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs w-12">
                      {row.tl_tam !== null ? row.tl_tam.toFixed(2) : '—'}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-xs font-medium w-14">
                      {row.tongTl.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-1 py-0.5 text-center h-7 w-14" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Toolbar (non-print) */}
        {!loading && !error && (
          <div className="border-t border-gray-200 bg-gray-50 p-3 production-plan-preview-noprint">
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
