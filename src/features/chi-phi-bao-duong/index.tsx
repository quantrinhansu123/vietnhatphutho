import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { formatDateVN } from '../so-che-do-may';
import { ChiPhiBaoDuongList } from './ChiPhiBaoDuongList';
import { ChiPhiBaoDuongForm } from './ChiPhiBaoDuongForm';
import { ChiPhiBaoDuongSheet } from './ChiPhiBaoDuongSheet';
import { ChiPhiBaoDuongSummaryModal } from './ChiPhiBaoDuongSummaryModal';
import type { ChiPhiBaoDuongRecord, MachineOption } from './types';
import { EXTRA_MACHINE_OPTIONS, firstDayOfMonth, lastDayOfMonth } from './types';
import { normalizeMachines } from '../danh-sach-may';

interface ChiPhiBaoDuongPanelProps {
  onBack: () => void;
  currentUser?: any;
}

export function ChiPhiBaoDuongPanel({ onBack, currentUser }: ChiPhiBaoDuongPanelProps) {
  const now = new Date();
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedRecord, setSelectedRecord] = useState<ChiPhiBaoDuongRecord | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const [tuNgay, setTuNgay] = useState(() =>
    firstDayOfMonth(now.getMonth() + 1, now.getFullYear())
  );
  const [denNgay, setDenNgay] = useState(() =>
    lastDayOfMonth(now.getMonth() + 1, now.getFullYear())
  );

  const [machineOptions, setMachineOptions] = useState<MachineOption[]>(EXTRA_MACHINE_OPTIONS);
  const [records, setRecords] = useState<ChiPhiBaoDuongRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/danh-sach-may')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const machines = normalizeMachines(data);
        const opts: MachineOption[] = machines
          .map(m => ({
            code: String(m.code || '').trim(),
            name: String(m.name || m.code || '').trim()
          }))
          .filter(m => Boolean(m.code));
        const seen = new Set(opts.map(o => o.code));
        const merged = [...opts];
        for (const extra of EXTRA_MACHINE_OPTIONS) {
          if (!seen.has(extra.code)) merged.push(extra);
        }
        setMachineOptions(merged);
      })
      .catch(() => {
        if (alive) setMachineOptions(EXTRA_MACHINE_OPTIONS);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadRecords = useCallback(async (tu: string, den: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tu_ngay: tu, den_ngay: den });
      const res = await fetch(`/api/chi-phi-bao-duong?${params.toString()}`);
      const data = await res.json().catch(() => ({ items: [] }));
      setRecords(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Error loading chi phi bao duong:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(tuNgay, denNgay);
  }, [tuNgay, denNgay, loadRecords]);

  const saveOne = useCallback(async (payload: Partial<ChiPhiBaoDuongRecord>) => {
    const isUpdate = Boolean(payload.id);
    const url = isUpdate
      ? `/api/chi-phi-bao-duong/${encodeURIComponent(payload.id!)}`
      : '/api/chi-phi-bao-duong';
    const res = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể lưu chi phí bảo dưỡng.');
    }
  }, []);

  const handleSaveMany = useCallback(
    async (payloads: Array<Partial<ChiPhiBaoDuongRecord>>) => {
      for (const p of payloads) await saveOne(p);
      const days = payloads.map(p => String(p.ngay || '')).filter(Boolean).sort();
      if (days.length > 0) {
        const tu = days[0] < tuNgay ? days[0] : tuNgay;
        const den = days[days.length - 1] > denNgay ? days[days.length - 1] : denNgay;
        setTuNgay(tu);
        setDenNgay(den);
        await loadRecords(tu, den);
      } else {
        await loadRecords(tuNgay, denNgay);
      }
      setViewMode('list');
      setSelectedRecord(null);
    },
    [saveOne, tuNgay, denNgay, loadRecords]
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/chi-phi-bao-duong/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Lỗi khi xóa chi phí bảo dưỡng.');
      return;
    }
    loadRecords(tuNgay, denNgay);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <BackButton onClick={viewMode === 'list' ? onBack : () => setViewMode('list')} />
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight text-slate-900">
              Chi phí bảo dưỡng
            </h1>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
              Sửa chữa, bảo dưỡng &amp; vật tư sử dụng theo ngày và máy (Từ {formatDateVN(tuNgay) || '?'} đến{' '}
              {formatDateVN(denNgay) || '?'})
            </p>
          </div>
        </div>
      </div>

      {viewMode === 'list' && (
        <ChiPhiBaoDuongList
          records={records}
          loading={loading}
          tuNgay={tuNgay}
          denNgay={denNgay}
          onFilterChange={(tu, den) => {
            setTuNgay(tu);
            setDenNgay(den);
          }}
          onRefresh={() => loadRecords(tuNgay, denNgay)}
          onAddNew={() => {
            setSelectedRecord(null);
            setViewMode('create');
          }}
          onEdit={rec => {
            setSelectedRecord(rec);
            setViewMode('edit');
          }}
          onView={rec => {
            setSelectedRecord(rec);
            setViewMode('view');
          }}
          onDelete={handleDelete}
          onOpenSummary={() => setShowSummary(true)}
        />
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <ChiPhiBaoDuongForm
          initialRecord={viewMode === 'edit' ? selectedRecord : null}
          machineOptions={machineOptions}
          currentUser={currentUser}
          onSave={saveOne}
          onSaveMany={handleSaveMany}
          onCancel={() => setViewMode('list')}
        />
      )}

      {viewMode === 'view' && selectedRecord && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại
              </button>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedRecord.ten_may || selectedRecord.ma_may} — Ngày{' '}
                  {formatDateVN(selectedRecord.ngay || '')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {selectedRecord.nguoi_lap ? `Người lập: ${selectedRecord.nguoi_lap}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
            >
              Chỉnh sửa
            </button>
          </div>
          <ChiPhiBaoDuongSheet
            thang={selectedRecord.thang}
            nam={selectedRecord.nam}
            rows={[selectedRecord]}
          />
        </div>
      )}

      {showSummary && (
        <ChiPhiBaoDuongSummaryModal
          onClose={() => setShowSummary(false)}
          defaultThang={now.getMonth() + 1}
          defaultNam={now.getFullYear()}
        />
      )}
    </div>
  );
}

export default ChiPhiBaoDuongPanel;
