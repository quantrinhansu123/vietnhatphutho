import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2, Search } from 'lucide-react';
import { MonthYearPickerVi } from '../chi-phi-nhan-cong/MonthYearPickerVi';
import { waitForPrintImagesReady } from '../../utils/printReady';
import { ChiPhiBaoDuongSheet } from './ChiPhiBaoDuongSheet';
import { ChiPhiBaoDuongPrintSheet } from './ChiPhiBaoDuongPrintSheet';
import type { ChiPhiBaoDuongRecord } from './types';
import { groupByMachine, prevMonthOf } from './types';

interface ChiPhiBaoDuongSummaryModalProps {
  onClose: () => void;
  defaultThang: number;
  defaultNam: number;
}

interface SummaryData {
  thang: number;
  nam: number;
  monthRows: ChiPhiBaoDuongRecord[];
  prevRows: ChiPhiBaoDuongRecord[];
  prevThang: number;
  prevNam: number;
}

async function fetchItems(params: URLSearchParams): Promise<ChiPhiBaoDuongRecord[]> {
  const res = await fetch(`/api/chi-phi-bao-duong?${params.toString()}`);
  const data = await res.json().catch(() => ({ items: [] }));
  return Array.isArray(data.items) ? data.items : [];
}

export function ChiPhiBaoDuongSummaryModal({
  onClose,
  defaultThang,
  defaultNam
}: ChiPhiBaoDuongSummaryModalProps) {
  const [thang, setThang] = useState(defaultThang);
  const [nam, setNam] = useState(defaultNam);
  const [viewed, setViewed] = useState<{ thang: number; nam: number } | null>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingPrint, setPendingPrint] = useState(false);

  const loadSummary = useCallback(async (t: number, n: number) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const prev = prevMonthOf(t, n);
      const [monthRows, prevRows] = await Promise.all([
        fetchItems(new URLSearchParams({ thang: String(t), nam: String(n) })),
        fetchItems(new URLSearchParams({ thang: String(prev.thang), nam: String(prev.nam) }))
      ]);
      setData({ thang: t, nam: n, monthRows, prevRows, prevThang: prev.thang, prevNam: prev.nam });
      setViewed({ thang: t, nam: n });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải tổng hợp tháng.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary(defaultThang, defaultNam);
  }, [defaultThang, defaultNam, loadSummary]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ===== In: dùng chung class in dot-san-xuat (CSS @media print sẵn có).
  // window.print() trực tiếp sẽ in cả modal fixed/overflow nên ra trắng —
  // phải render tờ in riêng ra portal batch + ẩn #root khi in.
  useEffect(() => {
    if (!pendingPrint) return;
    document.body.classList.add('dot-san-xuat-print-active');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
        setPendingPrint(false);
        document.body.classList.remove('dot-san-xuat-print-active');
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.body.classList.remove('dot-san-xuat-print-active');
    };
  }, [pendingPrint]);

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Tổng hợp chi phí bảo dưỡng theo tháng
            </h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              Bảng chi phí sửa chữa, bảo dưỡng &amp; vật tư sử dụng theo máy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <MonthYearPickerVi
            thang={thang}
            nam={nam}
            onChange={(t, n) => {
              setThang(t);
              setNam(n);
            }}
            label="Chọn tháng tổng hợp"
          />
          <button
            type="button"
            onClick={() => loadSummary(thang, nam)}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-5 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Xem
          </button>
          {viewed && (
            <span className="text-xs font-semibold text-slate-500">
              Đang xem: Tháng {viewed.thang}/{viewed.nam}
            </span>
          )}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => data && setPendingPrint(true)}
              disabled={!data || pendingPrint}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 disabled:opacity-60"
            >
              <Printer className="h-4 w-4" />
              In
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="mt-2 text-xs font-medium">Đang tải tổng hợp...</p>
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          ) : data ? (
            <ChiPhiBaoDuongSheet
              thang={data.thang}
              nam={data.nam}
              rows={groupByMachine(data.monthRows)}
              prevRows={data.prevRows}
              prevThang={data.prevThang}
              prevNam={data.prevNam}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
    )}
      {data &&
        pendingPrint &&
        createPortal(
          <div className="dot-san-xuat-print-batch">
            <ChiPhiBaoDuongPrintSheet
              thang={data.thang}
              nam={data.nam}
              rows={groupByMachine(data.monthRows)}
              prevRows={data.prevRows}
              prevThang={data.prevThang}
              prevNam={data.prevNam}
            />
          </div>,
          document.body
        )}
    </>
  );
}

export default ChiPhiBaoDuongSummaryModal;
