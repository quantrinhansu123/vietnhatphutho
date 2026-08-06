import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Printer, Save, XCircle } from 'lucide-react';
import { getProductionShiftOptions, normalizeShiftSettings } from '../utils/shiftSettings';
import { MixingNormRatioPrintBatch, type MixingNormRatioPrintDoc } from './MixingNormRatioPrintSheet';
import { waitForPrintImagesReady } from '../utils/printReady';

type ActualLine = {
  ma_nvl: string;
  ten_nvl: string;
  gia_tri: number | null;
  khoi_luong: number | null;
  phan_tram_thuc_te: number | null;
  trong_luong_thuc_te: number | null;
};
type ActualProduct = {
  ma_sp: string;
  ten_sp: string;
  tong_trong_luong: number | null;
  nvl: ActualLine[];
};
type NormRecord = { id: string; ngay: string; ca: string; ma_lenh_sx: string; chi_tiet: unknown };
type ActualRecord = { id: string; dinh_muc_id: string; chi_tiet: unknown; ghi_chu?: string };

const fieldClass = 'h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const numberValue = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const formatNumber = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);

function normalizeProducts(raw: unknown): ActualProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const product = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const total = numberValue(product.tong_trong_luong);
    const rawLines = Array.isArray(product.nvl) ? product.nvl : Array.isArray(product.chi_tiet) ? product.chi_tiet : [];
    return {
      ma_sp: String(product.ma_sp ?? ''),
      ten_sp: String(product.ten_sp ?? ''),
      tong_trong_luong: total,
      nvl: rawLines.map(item => {
        const line = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const actualPercent = numberValue(line.phan_tram_thuc_te);
        return {
          ma_nvl: String(line.ma_nvl ?? ''),
          ten_nvl: String(line.ten_nvl ?? ''),
          gia_tri: numberValue(line.gia_tri ?? line.dinh_muc),
          khoi_luong: numberValue(line.khoi_luong),
          phan_tram_thuc_te: actualPercent,
          trong_luong_thuc_te: numberValue(line.trong_luong_thuc_te) ?? (total !== null && actualPercent !== null ? total * actualPercent / 100 : null)
        };
      })
    };
  });
}

export default function ActualMixingSheetTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState('');
  const [shiftOptions, setShiftOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [norms, setNorms] = useState<NormRecord[]>([]);
  const [actuals, setActuals] = useState<ActualRecord[]>([]);
  const [selectedNormId, setSelectedNormId] = useState('');
  const [products, setProducts] = useState<ActualProduct[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [printDoc, setPrintDoc] = useState<MixingNormRatioPrintDoc | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/bang-tron-vat-tu-dinh-muc').then(res => res.json()),
      fetch('/api/phieu-tron-thuc-te').then(res => res.json()),
      fetch('/api/cai-dat').then(res => res.json())
    ]).then(([normData, actualData, settingData]) => {
      const rows = Array.isArray(normData.records) ? normData.records : [];
      setNorms(rows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''), ngay: String(row.ngay ?? '').slice(0, 10), ca: String(row.ca ?? ''),
        ma_lenh_sx: String(row.ma_lenh_sx ?? ''), chi_tiet: row.chi_tiet
      })));
      setActuals(Array.isArray(actualData.records) ? actualData.records : []);
      setShiftOptions(getProductionShiftOptions(normalizeShiftSettings(settingData)));
    }).catch(() => setError('Không thể tải dữ liệu phiếu trộn.')).finally(() => setLoading(false));
  }, []);

  const matchingNorms = useMemo(() => norms.filter(row => row.ngay === date && row.ca === shift), [norms, date, shift]);
  useEffect(() => {
    setSelectedNormId(matchingNorms.length === 1 ? matchingNorms[0].id : '');
    setError('');
    setMessage('');
    if (matchingNorms.length === 1) return;
    setProducts([]);
    setNote('');
  }, [date, shift, matchingNorms.length]);

  useEffect(() => {
    const norm = norms.find(row => row.id === selectedNormId);
    if (!norm) return;
    const saved = actuals.find(row => row.dinh_muc_id === selectedNormId);
    setProducts(normalizeProducts(saved?.chi_tiet ?? norm.chi_tiet));
    setNote(saved?.ghi_chu ?? '');
  }, [selectedNormId, norms, actuals]);

  const changePercent = (productIndex: number, lineIndex: number, text: string) => {
    const percent = numberValue(text);
    setProducts(current => current.map((product, pi) => pi !== productIndex ? product : {
      ...product,
      nvl: product.nvl.map((line, li) => li !== lineIndex ? line : {
        ...line,
        phan_tram_thuc_te: percent,
        trong_luong_thuc_te: product.tong_trong_luong !== null && percent !== null
          ? product.tong_trong_luong * percent / 100 : null
      })
    }));
  };

  const save = async () => {
    const norm = norms.find(row => row.id === selectedNormId);
    if (!norm) return setError('Vui lòng chọn phiếu định mức.');
    setSaving(true); setError(''); setMessage('');
    try {
      const existing = actuals.find(row => row.dinh_muc_id === norm.id);
      const res = await fetch('/api/phieu-tron-thuc-te', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing?.id, ngay: date, ca: shift, dinh_muc_id: norm.id, ma_lenh_sx: norm.ma_lenh_sx, ghi_chu: note, chi_tiet: products })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu phiếu.');
      if (!data.record?.id) throw new Error('Máy chủ không trả về phiếu vừa lưu. Vui lòng thử lại.');
      setActuals(current => [...current.filter(row => row.dinh_muc_id !== norm.id), data.record]);
      setMessage(existing ? 'Đã cập nhật phiếu trộn thực tế thành công.' : 'Đã lưu phiếu trộn thực tế thành công.');
    } catch (err: any) { setError(err.message || 'Không thể lưu phiếu.'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (!printDoc) return;
    document.body.classList.add('mixing-norm-ratio-print-active');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (!cancelled) window.print();
      });
    }, 120);
    const close = () => setPrintDoc(null);
    window.addEventListener('afterprint', close);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', close);
      document.body.classList.remove('mixing-norm-ratio-print-active');
    };
  }, [printDoc]);

  const print = () => {
    const norm = norms.find(row => row.id === selectedNormId);
    if (!norm) return;
    setPrintDoc({
      maLenhSx: norm.ma_lenh_sx,
      ngay: date,
      ca: shift,
      isActual: true,
      intro: 'Tỷ lệ trộn định mức và kết quả trộn thực tế như sau',
      products: products.map(product => ({
        ma_sp: product.ma_sp,
        ten_sp: product.ten_sp,
        tong_trong_luong: product.tong_trong_luong,
        ghi_chu: '',
        chi_tiet: product.nvl.map(line => ({
          ma_nvl: line.ma_nvl,
          ten_nvl: line.ten_nvl,
          gia_tri: line.gia_tri,
          don_vi: '%',
          khoi_luong: line.khoi_luong
        }))
      })),
      actualValues: products.map(product => product.nvl.map(line => ({
        percent: line.phan_tram_thuc_te,
        weight: line.trong_luong_thuc_te
      })))
    });
  };

  if (loading) return <div className="py-12 text-center text-sm font-bold text-zinc-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Đang tải...</div>;
  return <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
    <div>
      <h2 className="text-base font-black text-zinc-950">Phiếu trộn thực tế</h2>
      <p className="text-xs font-semibold text-zinc-500">Chọn ngày và ca để mở phiếu định mức tương ứng.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-xs font-black text-zinc-600">Ngày<input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldClass} /></label>
      <label className="grid gap-1 text-xs font-black text-zinc-600">Ca<select value={shift} onChange={e => setShift(e.target.value)} className={fieldClass}><option value="">Chọn ca</option>{shiftOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-black text-zinc-600">Phiếu định mức<select value={selectedNormId} onChange={e => { setSelectedNormId(e.target.value); setError(''); setMessage(''); }} disabled={!shift || matchingNorms.length === 0} className={fieldClass}><option value="">{matchingNorms.length ? 'Chọn phiếu' : 'Không có phiếu phù hợp'}</option>{matchingNorms.map(row => <option key={row.id} value={row.id}>{row.ma_lenh_sx || 'Không có mã lệnh'}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"><XCircle className="h-5 w-5 shrink-0" />{error}</p>}
    {message && <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</p>}
    {selectedNormId && products.map((product, pi) => <div key={`${product.ma_sp}-${pi}`} className="overflow-hidden rounded-xl border border-zinc-200">
      <div className="bg-zinc-100 px-3 py-2 text-sm font-black">{product.ma_sp} · {product.ten_sp} <span className="ml-2 text-zinc-500">Tổng TL: {formatNumber(product.tong_trong_luong)} kg</span></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-zinc-950 text-white"><tr><th className="px-3 py-2">Mã NVL</th><th className="px-3 py-2">Tên NVL</th><th className="px-3 py-2 text-right">% định mức</th><th className="px-3 py-2 text-right">Trọng lượng định mức</th><th className="px-3 py-2 text-right">% thực tế</th><th className="px-3 py-2 text-right">Trọng lượng thực tế</th></tr></thead>
      <tbody className="divide-y divide-zinc-100">{product.nvl.map((line, li) => <tr key={`${line.ma_nvl}-${li}`}><td className="px-3 py-2 font-mono font-bold">{line.ma_nvl}</td><td className="px-3 py-2">{line.ten_nvl}</td><td className="px-3 py-2 text-right font-mono">{formatNumber(line.gia_tri)}%</td><td className="px-3 py-2 text-right font-mono">{formatNumber(line.khoi_luong)} kg</td><td className="px-3 py-2"><input type="number" min="0" step="0.001" value={line.phan_tram_thuc_te ?? ''} onChange={e => changePercent(pi, li, e.target.value)} className={`${fieldClass} ml-auto block w-28 text-right`} /></td><td className="px-3 py-2 text-right font-mono font-black text-[#ef1b2d]">{formatNumber(line.trong_luong_thuc_te)} kg</td></tr>)}</tbody></table></div>
    </div>)}
    {selectedNormId && <div className="flex flex-wrap items-end justify-between gap-3"><label className="grid flex-1 gap-1 text-xs font-black text-zinc-600">Ghi chú<input value={note} onChange={e => setNote(e.target.value)} className={fieldClass} /></label><button type="button" onClick={print} className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800"><Printer className="h-4 w-4" />In phiếu</button><button type="button" onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Đang lưu...' : 'Lưu phiếu thực tế'}</button></div>}
    {printDoc ? <MixingNormRatioPrintBatch docs={[printDoc]} /> : null}
  </section>;
}
