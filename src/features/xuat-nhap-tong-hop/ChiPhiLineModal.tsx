import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import type { NvlInboundLotOption } from '../phieu-xuat-nhap-kho';
import { formatMoney, formatMoneyVN, formatNumber, parseLocalizedNumber } from '../../utils';
import { formatNvlPriceTyped } from './NvlPriceSelect';
import {
  chiPhiLineAmount,
  emptyChiPhiKemTheo,
  emptyChiPhiTheoPhieu,
  kemDraftError,
  sumKemDraft,
  type ChiPhiKemTheoDraft
} from './chiPhiKemTheo';
import { sortLotsFifo } from './lotAllocation';

const field =
  'h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function cloneItems(items: ChiPhiKemTheoDraft[]) {
  return items.map(item => ({ ...item }));
}

async function loadInboundLots(maNpl: string): Promise<NvlInboundLotOption[]> {
  const code = String(maNpl || '').trim();
  if (!code) return [];
  const res = await fetch(`/api/phieu-xuat-kho/lo-ton?ma_npl=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  const rows = Array.isArray((data as { lots?: unknown }).lots) ? (data as { lots: NvlInboundLotOption[] }).lots : [];
  return rows.filter(lot => String(lot.id || '').trim() && Number(lot.so_luong_con) > 0);
}

export function ChiPhiLineModal({
  open,
  title,
  maHang,
  items,
  disabled,
  /** Chỉ phiếu xuất: cho chọn chi phí theo phiếu nhập. Phiếu nhập chỉ hiện chi phí khác. */
  showTheoPhieu = false,
  onClose,
  onSave
}: {
  open: boolean;
  title: string;
  maHang: string;
  items: ChiPhiKemTheoDraft[];
  disabled?: boolean;
  showTheoPhieu?: boolean;
  onClose: () => void;
  onSave: (next: ChiPhiKemTheoDraft[]) => void;
}) {
  const [draft, setDraft] = useState<ChiPhiKemTheoDraft[]>(() => cloneItems(items));
  const [lots, setLots] = useState<NvlInboundLotOption[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const next = cloneItems(items.length ? items : []);
    setDraft(showTheoPhieu ? next : next.filter(item => (item.loai || 'khac') !== 'phieu'));
    setError('');
  }, [open, items, showTheoPhieu]);

  useEffect(() => {
    if (!open || !showTheoPhieu) {
      setLots([]);
      setLoadingLots(false);
      return;
    }
    const code = maHang.trim();
    if (!code) {
      setLots([]);
      return;
    }
    let cancelled = false;
    setLoadingLots(true);
    void loadInboundLots(code)
      .then(rows => {
        if (!cancelled) setLots(sortLotsFifo(rows));
      })
      .catch(() => {
        if (!cancelled) setLots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, maHang, showTheoPhieu]);

  const phieuItems = useMemo(() => draft.filter(item => (item.loai || 'khac') === 'phieu'), [draft]);
  const khacItems = useMemo(() => draft.filter(item => (item.loai || 'khac') !== 'phieu'), [draft]);
  const tong = sumKemDraft(draft);

  function patchItem(id: string, patch: Partial<ChiPhiKemTheoDraft>) {
    setDraft(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setDraft(current => current.filter(item => item.id !== id));
  }

  function applyLot(id: string, lotId: string) {
    const lot = lots.find(item => item.id === lotId);
    if (!lot) {
      patchItem(id, { lotId: '', maPhieu: '', donGia: '', ten: '' });
      return;
    }
    const price = formatMoneyVN(Number(lot.don_gia) || 0, 0);
    patchItem(id, {
      lotId: lot.id,
      maPhieu: lot.ma_phieu || '',
      donGia: price,
      ten: `Theo phiếu ${lot.ma_phieu || '—'}`,
      loai: 'phieu'
    });
  }

  function handleSave() {
    const source = showTheoPhieu ? draft : draft.filter(item => (item.loai || 'khac') !== 'phieu');
    const err = kemDraftError(title || 'Chi phí', source);
    if (err) {
      setError(err);
      return;
    }
    const cleaned = source
      .map(item => {
        if (showTheoPhieu && (item.loai || 'khac') === 'phieu') {
          const amount = chiPhiLineAmount(item);
          return {
            ...item,
            loai: 'phieu' as const,
            ten: item.ten.trim() || `Theo phiếu ${String(item.maPhieu || '').trim() || '—'}`,
            thanhTien: amount > 0 ? formatMoneyVN(amount, 0) : ''
          };
        }
        return { ...item, loai: 'khac' as const };
      })
      .filter(item => chiPhiLineAmount(item) > 0 || item.ten.trim());
    onSave(cleaned);
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-zinc-950">Chi phí kèm theo</p>
            <p className="truncate text-[11px] font-semibold text-zinc-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {showTheoPhieu ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-600">Theo phiếu nhập</p>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => setDraft(current => [...current, emptyChiPhiTheoPhieu()])}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#ef1b2d]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm phiếu
                  </button>
                ) : null}
              </div>
              {loadingLots ? (
                <p className="text-[11px] font-semibold text-zinc-400">Đang tải phiếu nhập…</p>
              ) : null}
              {phieuItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-500">
                  Chưa có phiếu. Bấm «Thêm phiếu» để chọn phiếu nhập, số lượng và giá.
                </p>
              ) : (
                phieuItems.map(item => {
                  const amount = chiPhiLineAmount(item);
                  return (
                    <div key={item.id} className="space-y-1.5 rounded-xl border border-sky-100 bg-sky-50/40 p-2.5">
                      <div className="flex items-start gap-2">
                        <label className="min-w-0 flex-1 space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Phiếu nhập</span>
                          {lots.length ? (
                            <select
                              value={item.lotId || ''}
                              disabled={disabled}
                              onChange={event => applyLot(item.id, event.target.value)}
                              className={field}
                            >
                              <option value="">Chọn phiếu nhập</option>
                              {lots.map(lot => (
                                <option key={lot.id} value={lot.id}>
                                  {lot.ma_phieu || 'Phiếu'} · {lot.ngay_phieu || ''} · còn {formatNumber(Number(lot.so_luong_con), 3)} · giá {formatMoneyVN(Number(lot.don_gia) || 0, 0)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={item.maPhieu || ''}
                              disabled={disabled}
                              placeholder="Mã phiếu nhập"
                              onChange={event =>
                                patchItem(item.id, {
                                  maPhieu: event.target.value.trim(),
                                  ten: event.target.value.trim() ? `Theo phiếu ${event.target.value.trim()}` : '',
                                  lotId: ''
                                })
                              }
                              className={field}
                            />
                          )}
                        </label>
                        {!disabled ? (
                          <button type="button" onClick={() => removeItem(item.id)} className="mt-5 text-rose-600" aria-label="Xóa phiếu">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Số lượng</span>
                          <input
                            value={item.soLuong || ''}
                            disabled={disabled}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={event => patchItem(item.id, { soLuong: event.target.value })}
                            onBlur={event => {
                              if (!event.target.value.trim()) return;
                              const parsed = parseLocalizedNumber(event.target.value);
                              if (Number.isFinite(parsed)) patchItem(item.id, { soLuong: formatNumber(parsed, 3) });
                            }}
                            className={field}
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Giá phiếu</span>
                          <input
                            value={item.donGia}
                            disabled={disabled}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={event => patchItem(item.id, { donGia: formatNvlPriceTyped(event.target.value) })}
                            onBlur={event => {
                              if (!event.target.value.trim()) return;
                              const parsed = parseLocalizedNumber(event.target.value);
                              if (Number.isFinite(parsed)) patchItem(item.id, { donGia: formatMoneyVN(parsed, 0) });
                            }}
                            className={`${field} text-right`}
                          />
                        </label>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Thành tiền</span>
                          <div className={`${field} flex items-center justify-end bg-zinc-50 font-mono text-zinc-800`}>
                            {amount > 0 ? formatMoney(amount, 0) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-600">Chi phí khác</p>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => setDraft(current => [...current, { ...emptyChiPhiKemTheo(), ten: '', donGia: '', thanhTien: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-600"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm chi phí khác
                </button>
              ) : null}
            </div>
            {khacItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-500">
                Chưa có chi phí khác.
              </p>
            ) : (
              khacItems.map(item => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_7rem_1.75rem] items-end gap-1.5">
                  <label className="min-w-0 space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Tên chi phí</span>
                    <input
                      value={item.ten}
                      disabled={disabled}
                      placeholder="VD: Chi phí mua hàng"
                      onChange={event => patchItem(item.id, { ten: event.target.value.slice(0, 120) })}
                      className={field}
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Giá tiền</span>
                    <input
                      value={item.thanhTien}
                      disabled={disabled}
                      inputMode="decimal"
                      placeholder="0"
                      onChange={event => {
                        const money = formatNvlPriceTyped(event.target.value);
                        patchItem(item.id, { thanhTien: money, donGia: money });
                      }}
                      onBlur={event => {
                        if (!event.target.value.trim()) return;
                        const parsed = parseLocalizedNumber(event.target.value);
                        if (!Number.isFinite(parsed)) return;
                        const money = formatMoneyVN(parsed, 0);
                        patchItem(item.id, { thanhTien: money, donGia: money });
                      }}
                      className={`${field} text-right`}
                    />
                  </label>
                  {!disabled ? (
                    <button type="button" onClick={() => removeItem(item.id)} className="mb-1 text-rose-600" aria-label="Xóa chi phí">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-zinc-100 px-4 py-3">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
            <span>Tổng chi phí</span>
            <span className="font-mono">{formatMoney(tong, 0)}</span>
          </div>
          {error ? <p className="text-[11px] font-semibold text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white text-xs font-extrabold text-zinc-700"
            >
              Hủy
            </button>
            {!disabled ? (
              <button
                type="button"
                onClick={handleSave}
                className="h-9 flex-1 rounded-lg bg-[#ef1b2d] text-xs font-extrabold text-white"
              >
                Lưu chi phí
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
