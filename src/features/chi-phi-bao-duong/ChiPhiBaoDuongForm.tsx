import React, { useMemo, useState } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Cpu } from 'lucide-react';
import { VnCalendarPicker, parseDateStr } from '../so-che-do-may';
import type { ChiPhiBaoDuongRecord, MachineOption, CostItem } from './types';
import { fmtMoney, newCostItem, sumCostItems, itemsOfRecord, toDateStrLocal } from './types';

interface MachineBlock {
  key: string;
  maMay: string;
  suaItems: CostItem[];
  vatItems: CostItem[];
}

interface ChiPhiBaoDuongFormProps {
  initialRecord?: ChiPhiBaoDuongRecord | null;
  machineOptions: MachineOption[];
  currentUser?: any;
  onSave: (payload: Partial<ChiPhiBaoDuongRecord>) => Promise<void>;
  onSaveMany?: (payloads: Array<Partial<ChiPhiBaoDuongRecord>>) => Promise<void>;
  onCancel: () => void;
}

function parseMoneyInput(raw: string): number {
  const cleaned = String(raw || '').replace(/[^\d]/g, '');
  const n = cleaned ? Number(cleaned) : 0;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function machineNameOf(machineOptions: MachineOption[], maMay: string): string {
  const found = machineOptions.find(m => m.code === maMay);
  return found ? found.name : maMay;
}

function CostItemRows({
  title,
  items,
  onChange,
  giaPlaceholder,
  accent
}: {
  title: string;
  items: CostItem[];
  onChange: (items: CostItem[]) => void;
  giaPlaceholder: string;
  accent: 'amber' | 'emerald';
}) {
  const subtotal = sumCostItems(items);
  const subBg = accent === 'amber' ? 'bg-amber-50/70 text-amber-900' : 'bg-emerald-50/70 text-emerald-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">{title}</h3>
        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${subBg}`}>
          Tổng: {fmtMoney(subtotal)} đ
        </span>
      </div>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-start gap-2">
            <input
              type="text"
              value={it.noi_dung}
              onChange={e =>
                onChange(items.map(x => (x.key === it.key ? { ...x, noi_dung: e.target.value } : x)))
              }
              placeholder={`Nội dung ${idx + 1} (VD: thay lưới cắt)`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <input
              type="text"
              inputMode="numeric"
              value={it.gia ? fmtMoney(it.gia) : ''}
              onChange={e => {
                const gia = parseMoneyInput(e.target.value);
                onChange(items.map(x => (x.key === it.key ? { ...x, gia } : x)));
              }}
              placeholder={giaPlaceholder}
              className="h-9 w-32 shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-right text-xs font-bold text-slate-900 shadow-sm transition placeholder:font-normal placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              title="Xóa dòng"
              onClick={() => onChange(items.filter(x => x.key !== it.key))}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, newCostItem()])}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-400 hover:text-brand-700 active:scale-95"
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm dòng
      </button>
    </div>
  );
}

export function ChiPhiBaoDuongForm({
  initialRecord,
  machineOptions,
  currentUser,
  onSave,
  onSaveMany,
  onCancel
}: ChiPhiBaoDuongFormProps) {
  const isEditing = Boolean(initialRecord?.id);
  const [ngay, setNgay] = useState(
    () =>
      (initialRecord?.ngay && parseDateStr(initialRecord.ngay) ? initialRecord.ngay : null) ||
      toDateStrLocal(new Date())
  );
  const [nguoiLap, setNguoiLap] = useState(
    () => initialRecord?.nguoi_lap || currentUser?.name || currentUser?.username || ''
  );
  const [blocks, setBlocks] = useState<MachineBlock[]>(() => {
    if (initialRecord) {
      const { sua, vat } = itemsOfRecord(initialRecord);
      return [
        {
          key: 'block-edit',
          maMay: initialRecord.ma_may || '',
          suaItems: sua.length > 0 ? sua : [newCostItem()],
          vatItems: vat.length > 0 ? vat : [newCostItem()]
        }
      ];
    }
    return [{ key: `block-${Date.now()}`, maMay: '', suaItems: [newCostItem()], vatItems: [newCostItem()] }];
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const updateBlock = (key: string, patch: Partial<MachineBlock>) => {
    setBlocks(prev => prev.map(b => (b.key === key ? { ...b, ...patch } : b)));
  };

  const grandTotal = useMemo(
    () =>
      blocks.reduce((s, b) => s + sumCostItems(b.suaItems) + sumCostItems(b.vatItems), 0),
    [blocks]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!parseDateStr(ngay)) {
      setErrorMsg('Vui lòng chọn ngày phát sinh hợp lệ.');
      return;
    }
    const filled = blocks.filter(b => b.maMay);
    if (filled.length === 0) {
      setErrorMsg('Vui lòng chọn máy cho ít nhất 1 khối.');
      return;
    }
    const payloads = filled.map(b => {
      const sua = b.suaItems
        .filter(it => it.noi_dung.trim() || it.gia > 0)
        .map(it => ({ noi_dung: it.noi_dung.trim(), gia: it.gia }));
      const vat = b.vatItems
        .filter(it => it.noi_dung.trim() || it.gia > 0)
        .map(it => ({ noi_dung: it.noi_dung.trim(), gia: it.gia }));
      return {
        ...(isEditing && initialRecord?.id ? { id: initialRecord.id } : {}),
        ngay,
        ma_may: b.maMay,
        ten_may: machineNameOf(machineOptions, b.maMay) || b.maMay,
        chi_tiet: { sua_chua_items: sua, vat_tu_items: vat },
        nguoi_lap: nguoiLap.trim()
      } as Partial<ChiPhiBaoDuongRecord>;
    });
    setSaving(true);
    try {
      if (payloads.length === 1 && !onSaveMany) {
        await onSave(payloads[0]);
      } else if (onSaveMany) {
        await onSaveMany(payloads);
      } else {
        for (const p of payloads) await onSave(p);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu chi phí bảo dưỡng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-4xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="font-display text-sm font-bold text-slate-900">
          {isEditing ? 'Sửa chi phí bảo dưỡng' : 'Thêm chi phí bảo dưỡng'}
        </h2>
        <p className="mt-0.5 text-[11.5px] text-slate-500">
          Chọn ngày phát sinh, thêm từng máy; mỗi máy nhập nhiều dòng nội dung + giá cho 2 phần.
          Mỗi lần lưu tạo 1 dòng mới (kể cả trùng Ngày + Máy).
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Ngày phát sinh</label>
          <VnCalendarPicker value={ngay} onChange={setNgay} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Người lập</label>
          <input
            type="text"
            value={nguoiLap}
            onChange={e => setNguoiLap(e.target.value)}
            placeholder="Tên người nhập"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((block, bi) => {
          const blockTotal = sumCostItems(block.suaItems) + sumCostItems(block.vatItems);
          return (
            <div key={block.key} className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Cpu className="h-3.5 w-3.5 text-brand-600" />
                    Máy {blocks.length > 1 ? `#${bi + 1}` : ''}
                  </label>
                  <select
                    value={block.maMay}
                    onChange={e => updateBlock(block.key, { maMay: e.target.value })}
                    disabled={isEditing}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
                  >
                    <option value="">-- Chọn máy --</option>
                    {machineOptions.map(m => (
                      <option key={m.code} value={m.code}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
                {!isEditing && blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBlocks(prev => prev.filter(b => b.key !== block.key))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-rose-200 hover:text-rose-600 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa máy
                  </button>
                )}
                <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                  {fmtMoney(blockTotal)} đ
                </span>
              </div>

              <CostItemRows
                title="Chi phí sửa chữa"
                items={block.suaItems}
                onChange={items => updateBlock(block.key, { suaItems: items })}
                giaPlaceholder="Giá (đ)"
                accent="amber"
              />
              <CostItemRows
                title="Vật tư sử dụng"
                items={block.vatItems}
                onChange={items => updateBlock(block.key, { vatItems: items })}
                giaPlaceholder="Giá (đ)"
                accent="emerald"
              />
            </div>
          );
        })}
      </div>

      {!isEditing && (
        <button
          type="button"
          onClick={() =>
            setBlocks(prev => [
              ...prev,
              { key: `block-${Date.now()}`, maMay: '', suaItems: [newCostItem()], vatItems: [newCostItem()] }
            ])
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Thêm máy mới
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tổng phiếu: <strong className="text-sm text-slate-900">{fmtMoney(grandTotal)} đ</strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-5 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Lưu sửa đổi' : `Lưu (${blocks.filter(b => b.maMay).length || 1} máy)`}
          </button>
        </div>
      </div>
    </form>
  );
}

export default ChiPhiBaoDuongForm;
