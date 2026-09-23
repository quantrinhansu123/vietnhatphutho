import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Eye, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';

export interface ChuyenKhoLine {
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  so_luong: number;
  kg_mot_sp: number | null;
  m2_mot_sp: number | null;
  m_dai_mot_sp: number | null;
}

export interface ChuyenKhoPhieu {
  id: string;
  ma_phieu: string;
  ngay: string;
  trang_thai: string;
  kho_nguon: string;
  kho_dich: string;
  chi_tiet: ChuyenKhoLine[];
  ma_phieu_xuat: string | null;
  ma_phieu_nhap: string | null;
  ma_phieu_xuat_huy: string | null;
  ma_phieu_nhap_huy: string | null;
  nguoi_thuc_hien: string | null;
  nguoi_lap: string | null;
  ghi_chu: string | null;
  created_at?: string;
}

interface SourceStockRow {
  key: string;
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  ton_sl: number;
  kg1: number;
  a1: number;
  l1: number;
  specs: Record<string, string>;
}

interface TransferLine {
  key: string;
  stockKey: string;
  qtyText: string;
}

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const cellInputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[13px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const readonlyCellClass =
  'h-9 w-full rounded-lg border border-zinc-100 bg-zinc-50 px-2 text-right text-[13px] font-bold text-zinc-700';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toNum(value: unknown): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '—';
  return String(Math.round(Number(value) * 1000) / 1000);
}

function isVatTuKhoName(name: string): boolean {
  const n = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  return n.includes('nvl') || n.includes('nguyen vat lieu') || n.includes('vat tu');
}

function trangThaiLabel(value: string): string {
  if (value === 'hoan_thanh') return 'Hoàn thành';
  if (value === 'huy') return 'Đã hủy';
  return 'Mới';
}

/** Mở chi tiết phiếu XN ở tab mới (mẫu chung của Lịch sử XN). */
function openSlipDetail(slipCode: string) {
  if (!slipCode) return;
  window.open(`/lich-su-xuat-nhap-kho/phieu?ma_phieu=${encodeURIComponent(slipCode)}`, '_blank', 'noopener');
}

function SlipCodeButton({ code, label, emptyText = '—' }: { code: string | null | undefined; label: string; emptyText?: string }) {
  if (!code) return <span className="font-sans font-semibold text-zinc-400">{emptyText}</span>;
  return (
    <button
      type="button"
      title={`Xem ${label} ${code}`}
      onClick={() => openSlipDetail(code)}
      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-700 hover:underline"
    >
      {code} <Eye size={12} />
    </button>
  );
}

let lineSeq = 0;
const newTransferLine = (): TransferLine => {
  lineSeq += 1;
  return { key: `tline-${Date.now()}-${lineSeq}`, stockKey: '', qtyText: '' };
};

/** Tờ in dùng chung xem trước + batch in (CSS dot-san-xuat-print-*). */
function ChuyenKhoPrintSheet({ phieu }: { phieu: ChuyenKhoPhieu }) {
  const lines = Array.isArray(phieu.chi_tiet) ? phieu.chi_tiet : [];
  const tongSl = lines.reduce((sum, line) => sum + (Number(line.so_luong) || 0), 0);
  const tongKg = lines.reduce(
    (sum, line) => sum + (Number(line.kg_mot_sp) || 0) * (Number(line.so_luong) || 0),
    0
  );
  const printDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const signDateParts = (() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(phieu.ngay || ''));
    if (match) return { day: match[3], month: match[2], year: match[1] };
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return { day: pad(now.getDate()), month: pad(now.getMonth() + 1), year: String(now.getFullYear()) };
  })();
  const slipTable = (rows: ChuyenKhoLine[]) => (
    <table className="dot-san-xuat-print-table">
      <thead>
        <tr>
          <th className="dot-san-xuat-print-center">STT</th>
          <th>Mã SP</th>
          <th>Tên SP</th>
          <th className="dot-san-xuat-print-center">ĐVT</th>
          <th className="dot-san-xuat-print-right">SL</th>
          <th className="dot-san-xuat-print-right">KG</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((line, index) => (
          <tr key={index}>
            <td className="dot-san-xuat-print-center">{index + 1}</td>
            <td>{line.ma_sp}</td>
            <td>{line.ten_sp}</td>
            <td className="dot-san-xuat-print-center">{line.don_vi}</td>
            <td className="dot-san-xuat-print-right">{line.so_luong}</td>
            <td className="dot-san-xuat-print-right">
              {fmtQty((Number(line.kg_mot_sp) || 0) * (Number(line.so_luong) || 0))}
            </td>
          </tr>
        ))}
        <tr className="dot-san-xuat-print-total">
          <td colSpan={4}>Tổng</td>
          <td className="dot-san-xuat-print-right">{fmtQty(tongSl)}</td>
          <td className="dot-san-xuat-print-right">{fmtQty(tongKg)}</td>
        </tr>
      </tbody>
    </table>
  );
  return (
    <div className="dot-san-xuat-print-sheet">
      <div className="dot-san-xuat-print-doc">
        <div className="dot-san-xuat-print-header">
          <div className="dot-san-xuat-print-brand">
            <img src={vietNhatLogoUrl} alt="Việt Nhật" className="dot-san-xuat-print-logo" />
            <div>
              <p className="dot-san-xuat-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="dot-san-xuat-print-project-name">Kho — Chuyển kho thành phẩm</p>
            </div>
          </div>
          <h1 className="dot-san-xuat-print-title">PHIẾU CHUYỂN KHO</h1>
          <div className="dot-san-xuat-print-meta">
            <p>
              Số: {phieu.ma_phieu} · Ngày: {formatDateVN(phieu.ngay)} · Trạng thái:{' '}
              {trangThaiLabel(phieu.trang_thai)}
            </p>
            <p>
              {phieu.kho_nguon} → {phieu.kho_dich}
            </p>
            <p>
              Người thực hiện: {phieu.nguoi_thuc_hien || '—'} · Người lập: {phieu.nguoi_lap || '—'}
            </p>
            {phieu.ghi_chu ? <p>Ghi chú: {phieu.ghi_chu}</p> : null}
          </div>
        </div>
        <h2 className="dot-san-xuat-print-subtitle">
          I. Phiếu xuất — {phieu.kho_nguon} ({phieu.ma_phieu_xuat || 'chưa sinh'})
        </h2>
        {slipTable(lines)}
        <h2 className="dot-san-xuat-print-subtitle">
          II. Phiếu nhập — {phieu.kho_dich} ({phieu.ma_phieu_nhap || 'chưa sinh'})
        </h2>
        {slipTable(lines)}
        {phieu.ma_phieu_xuat_huy || phieu.ma_phieu_nhap_huy ? (
          <>
            <h2 className="dot-san-xuat-print-subtitle">III. Phiếu đảo (Hủy chuyển kho)</h2>
            <p>
              Xuất: {phieu.ma_phieu_xuat_huy || '—'} · Nhập: {phieu.ma_phieu_nhap_huy || '—'}
            </p>
          </>
        ) : null}
        <p style={{ marginTop: '6mm', textAlign: 'right', fontStyle: 'italic' }}>
          Phú Thọ, ngày {signDateParts.day} tháng {signDateParts.month} năm {signDateParts.year}
        </p>
        <div className="dot-san-xuat-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
            <div style={{ marginTop: '12mm', fontWeight: 700 }}>{phieu.nguoi_lap || ''}</div>
          </div>
          <div>
            <p>Người giao</p>
            <span>(Ký, ghi rõ họ tên)</span>
            <div style={{ marginTop: '12mm', fontWeight: 700 }}>{phieu.nguoi_thuc_hien || ''}</div>
          </div>
          <div>
            <p>Người nhận</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Thủ kho</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
        <p className="dot-san-xuat-print-note">Ngày in: {printDate}</p>
      </div>
    </div>
  );
}

export function ChuyenKhoPanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit } = useTabAccess('chuyen-kho');
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [records, setRecords] = useState<ChuyenKhoPhieu[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [stock, setStock] = useState<SourceStockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [completingId, setCompletingId] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [printPhieu, setPrintPhieu] = useState<ChuyenKhoPhieu | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [timSp, setTimSp] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [ngayChuyen, setNgayChuyen] = useState(todayISO());
  const [khoNguon, setKhoNguon] = useState('');
  const [khoDich, setKhoDich] = useState('');
  const [nguoiThucHien, setNguoiThucHien] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([newTransferLine()]);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/quan-ly-kho');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được danh sách kho.'));
      const list: Array<{ ten_kho?: string }> = Array.isArray((data as { records?: unknown }).records)
        ? (data as { records: Array<{ ten_kho?: string }> }).records
        : [];
      const names = Array.from(
        new Set(list.map(item => String(item.ten_kho ?? '').trim()).filter(name => name && !isVatTuKhoName(name)))
      ).sort((a, b) => a.localeCompare(b, 'vi'));
      setWarehouses(names);
    } catch (err: any) {
      setWarehouses([]);
      showAppToast(err?.message || 'Không tải được danh sách kho.', 'error');
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/chuyen-kho');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được phiếu chuyển kho.'));
      const list = Array.isArray((data as { records?: unknown }).records)
        ? ((data as { records: unknown[] }).records as ChuyenKhoPhieu[])
        : [];
      setRecords(list);
    } catch (err: any) {
      setRecords([]);
      showAppToast(err?.message || 'Không tải được phiếu chuyển kho.', 'error');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWarehouses();
    void loadRecords();
  }, [loadWarehouses, loadRecords]);

  useEffect(() => {
    if (!pendingPrint || !printPhieu) return;
    document.body.classList.add('dot-san-xuat-print-active');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      window.print();
      setPendingPrint(false);
      document.body.classList.remove('dot-san-xuat-print-active');
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.body.classList.remove('dot-san-xuat-print-active');
    };
  }, [pendingPrint, printPhieu]);

  useEffect(() => {
    if (!printPhieu) setPendingPrint(false);
  }, [printPhieu]);

  const filteredRecords = useMemo(() => {
    const from = filterFrom ? filterFrom.slice(0, 10) : '';
    const to = filterTo ? filterTo.slice(0, 10) : '';
    const q = timSp.trim().toLocaleLowerCase('vi');
    return records.filter(row => {
      const ngay = String(row.ngay || '').slice(0, 10);
      if (from || to) {
        if (!ngay) return false;
        if (from && ngay < from) return false;
        if (to && ngay > to) return false;
      }
      if (q) {
        const chiTiet = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
        const hay = [
          row.ma_phieu,
          row.kho_nguon,
          row.kho_dich,
          row.nguoi_thuc_hien,
          row.nguoi_lap,
          row.ghi_chu,
          row.ma_phieu_xuat,
          row.ma_phieu_nhap,
          ...chiTiet.flatMap(line => [line.ma_sp, line.ten_sp, line.nhom_vthh])
        ]
          .map(v => String(v ?? '').toLocaleLowerCase('vi'))
          .join(' | ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filterFrom, filterTo, timSp]);

  const loadStock = useCallback(async (tenKho: string) => {
    if (!tenKho) {
      setStock([]);
      return;
    }
    setStockLoading(true);
    try {
      const params = new URLSearchParams({ from: '2020-01-01', to: todayISO(), tenKho, strictKho: '1' });
      const res = await fetch(`/api/nhap-kho?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được tồn kho nguồn.'));
      const rows: unknown[] = Array.isArray((data as { rows?: unknown }).rows)
        ? (data as { rows: unknown[] }).rows
        : [];
      const mapped: SourceStockRow[] = [];
      for (const item of rows) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        const ton = (row.ton_cuoi ?? {}) as Record<string, unknown>;
        const tonSl = toNum(ton.sl);
        if (!(tonSl > 0)) continue;
        const ma = String(row.ma_sp ?? '').trim();
        const ten = String(row.ten_sp ?? '').trim();
        if (!ma && !ten) continue;
        const kg1 = toNum(row.trong_luong_kg_mot_sp);
        const a1 = toNum(row.so_m2_mot_sp);
        const l1 = toNum(row.so_m_dai_mot_sp);
        const text = (v: unknown) => String(v ?? '').trim();
        mapped.push({
          key: `${ma}||${ten}||${kg1}|${a1}|${l1}`,
          ma_sp: ma,
          ten_sp: ten,
          don_vi: text(row.don_vi),
          nhom_vthh: text(row.nhom_vthh),
          ton_sl: tonSl,
          kg1,
          a1,
          l1,
          specs: {
            ten_goc: text(row.ten_goc),
            do_li: text(row.do_li),
            do_li_dm: text(row.do_li_dm),
            do_day_m: text(row.do_day_m),
            do_dai_m: text(row.do_dai_m),
            mang: text(row.mang),
            hang_phe: text(row.hang_phe),
            ma_amis: text(row.ma_amis)
          }
        });
      }
      mapped.sort((a, b) => `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi'));
      setStock(mapped);
    } catch (err: any) {
      setStock([]);
      showAppToast(err?.message || 'Không tải được tồn kho nguồn.', 'error');
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStock(khoNguon);
  }, [khoNguon, loadStock]);

  const handleKhoNguonChange = (value: string) => {
    setKhoNguon(value);
    setLines([newTransferLine()]);
  };

  const openModal = () => {
    setEditingId(null);
    setNgayChuyen(todayISO());
    setKhoNguon('');
    setKhoDich('');
    setNguoiThucHien('');
    setNguoiLap('');
    setGhiChu('');
    setLines([newTransferLine()]);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (row: ChuyenKhoPhieu) => {
    if (String(row.trang_thai) !== 'moi') return;
    const chiTiet = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
    lineSeq += 1;
    setEditingId(row.id);
    setNgayChuyen(String(row.ngay || '').slice(0, 10) || todayISO());
    setKhoNguon(row.kho_nguon || '');
    setKhoDich(row.kho_dich || '');
    setNguoiThucHien(row.nguoi_thuc_hien || '');
    setNguoiLap(row.nguoi_lap || '');
    setGhiChu(row.ghi_chu || '');
    setLines(
      chiTiet.length > 0
        ? chiTiet.map((line, idx) => {
            const ma = String(line.ma_sp || '').trim();
            const ten = String(line.ten_sp || '').trim();
            const kg = Number(line.kg_mot_sp) || 0;
            const a = Number(line.m2_mot_sp) || 0;
            const l = Number(line.m_dai_mot_sp) || 0;
            return {
              key: `tline-edit-${Date.now()}-${lineSeq}-${idx}`,
              stockKey: `${ma}||${ten}||${kg}|${a}|${l}`,
              qtyText: String(line.so_luong ?? '')
            };
          })
        : [newTransferLine()]
    );
    setModalError('');
    setShowModal(true);
  };

  const updateLine = (key: string, patch: Partial<TransferLine>) => {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(line => line.key !== key)));
  };

  interface LineView {
    row: SourceStockRow | null;
    qty: number;
    kg: number;
    m2: number;
    mDai: number;
    error: string;
  }

  const views: LineView[] = useMemo(
    () =>
      lines.map(line => {
        const row =
          stock.find(item => item.key === line.stockKey) ||
          stock.find(item => {
            const [ma, ten] = String(line.stockKey || '').split('||');
            return ma && ten && item.ma_sp === ma && item.ten_sp === ten;
          }) ||
          stock.find(item => {
            const [ma] = String(line.stockKey || '').split('||');
            return ma && item.ma_sp === ma;
          }) ||
          null;
        if (!row) return { row, qty: 0, kg: 0, m2: 0, mDai: 0, error: '' };
        const qty = Number(String(line.qtyText || '').replace(',', '.'));
        if (!(qty > 0)) return { row, qty: 0, kg: 0, m2: 0, mDai: 0, error: 'Nhập số lượng chuyển.' };
        if (qty > row.ton_sl + 1e-9) return { row, qty, kg: 0, m2: 0, mDai: 0, error: `Tồn nguồn chỉ còn ${row.ton_sl}.` };
        return {
          row,
          qty,
          kg: Math.round(row.kg1 * qty * 1000) / 1000,
          m2: Math.round(row.a1 * qty * 1000) / 1000,
          mDai: Math.round(row.l1 * qty * 1000) / 1000,
          error: ''
        };
      }),
    [lines, stock]
  );

  const totals = useMemo(() => {
    let qty = 0;
    let kg = 0;
    let m2 = 0;
    let mDai = 0;
    views.forEach(view => {
      if (view.error || !view.row) return;
      qty += view.qty;
      kg += view.kg;
      m2 += view.m2;
      mDai += view.mDai;
    });
    return {
      qty: Math.round(qty * 1000) / 1000,
      kg: Math.round(kg * 1000) / 1000,
      m2: Math.round(m2 * 1000) / 1000,
      mDai: Math.round(mDai * 1000) / 1000
    };
  }, [views]);

  const headerError = useMemo(() => {
    if (!khoNguon) return 'Chọn kho nguồn.';
    if (!khoDich) return 'Chọn kho đích.';
    if (khoNguon.trim() === khoDich.trim()) return 'Kho nguồn và kho đích phải khác nhau.';
    return '';
  }, [khoNguon, khoDich]);

  const canSave =
    !headerError && lines.length > 0 && views.every(view => view.row && !view.error && view.qty > 0);

  const handleSave = async () => {
    if (!canSave) {
      const lineError = views.find(view => view.error)?.error;
      setModalError(lineError || headerError || 'Còn dòng chưa hợp lệ.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const payloadLines = lines.map((line, index) => {
        const view = views[index];
        const row = view.row!;
        return {
          ma_sp: row.ma_sp,
          ten_sp: row.ten_sp,
          don_vi: row.don_vi,
          nhom_vthh: row.nhom_vthh,
          so_luong: view.qty,
          kg_mot_sp: row.kg1 > 0 ? row.kg1 : null,
          m2_mot_sp: row.a1 > 0 ? row.a1 : null,
          m_dai_mot_sp: row.l1 > 0 ? row.l1 : null,
          ...row.specs
        };
      });
      const url = editingId ? `/api/chuyen-kho/${encodeURIComponent(editingId)}` : '/api/chuyen-kho';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngay: ngayChuyen,
          khoNguon,
          khoDich,
          lines: payloadLines,
          nguoiThucHien: nguoiThucHien.trim(),
          nguoiLap: nguoiLap.trim(),
          ghiChu: ghiChu.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          readApiErrorMessage(res, data, editingId ? 'Không sửa được phiếu chuyển kho.' : 'Không lưu được phiếu chuyển kho.')
        );
      showAppToast(editingId ? 'Đã lưu sửa phiếu chuyển kho.' : 'Đã lưu phiếu chuyển kho (Mới).', 'success');
      setShowModal(false);
      setEditingId(null);
      void loadRecords();
    } catch (err: any) {
      setModalError(err?.message || 'Không lưu được phiếu chuyển kho.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    if (!window.confirm('Hoàn thành chuyển kho? Hệ thống sinh 2 phiếu: xuất nguồn + nhập đích.')) return;
    setCompletingId(id);
    try {
      const res = await fetch(`/api/chuyen-kho/${encodeURIComponent(id)}/hoan-thanh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không hoàn thành được phiếu chuyển kho.'));
      showAppToast('Đã chuyển kho — sinh đủ 2 phiếu.', 'success');
      const record = (data as { record?: ChuyenKhoPhieu }).record;
      if (record) setPrintPhieu(record);
      void loadRecords();
    } catch (err: any) {
      showAppToast(err?.message || 'Không hoàn thành được phiếu chuyển kho.', 'error');
    } finally {
      setCompletingId('');
    }
  };

  const handleCancel = async (id: string, done: boolean) => {
    if (
      !window.confirm(
        done
          ? 'Hủy phiếu đã hoàn thành? Hệ thống sinh thêm 2 phiếu đảo với lý do "Hủy chuyển kho".'
          : 'Hủy phiếu nháp này?'
      )
    ) {
      return;
    }
    setCancellingId(id);
    try {
      const res = await fetch(`/api/chuyen-kho/${encodeURIComponent(id)}/huy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không hủy được phiếu chuyển kho.'));
      showAppToast(done ? 'Đã hủy — sinh 2 phiếu đảo.' : 'Đã hủy phiếu chuyển kho.', 'success');
      const record = (data as { record?: ChuyenKhoPhieu }).record;
      if (record && done) setPrintPhieu(record);
      void loadRecords();
    } catch (err: any) {
      showAppToast(err?.message || 'Không hủy được phiếu chuyển kho.', 'error');
    } finally {
      setCancellingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Chuyển kho</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Chuyển sản phẩm qua lại giữa các kho — hoàn thành sinh 2 phiếu (xuất + nhập), hủy sinh 2 phiếu đảo.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canCreate && (
            <button
              onClick={openModal}
              className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-4 py-2 text-sm font-black text-white"
            >
              <Plus size={16} /> Chuyển kho
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <VnCalendarPicker value={filterFrom} onChange={setFilterFrom} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <VnCalendarPicker value={filterTo} onChange={setFilterTo} />
          </div>
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Tìm SP</span>
            <input
              value={timSp}
              onChange={e => setTimSp(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
              placeholder="Mã / QR / tên / tính chất / nhóm"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadRecords()}
            className="rounded-lg bg-[#ef1b2d] px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-[#d41424]"
          >
            Tải lại
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <span className="text-xs font-black uppercase text-zinc-600">
            Phiếu chuyển kho{' '}
            {listLoading
              ? '(đang tải...)'
              : filteredRecords.length !== records.length
                ? `(${filteredRecords.length}/${records.length})`
                : `(${records.length})`}
          </span>
          {(filterFrom || filterTo || timSp.trim()) && (
            <button
              onClick={() => {
                setFilterFrom('');
                setFilterTo('');
                setTimSp('');
              }}
              className="ml-auto rounded-lg border px-3 py-2 text-xs font-bold text-zinc-600"
            >
              Xóa lọc
            </button>
          )}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1020px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Mã phiếu</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Nguồn → Đích</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2">Người lập</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Phiếu XN</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(row => {
                const chiTiet = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
                const tongSl = chiTiet.reduce((sum, line) => sum + (Number(line.so_luong) || 0), 0);
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-black">{row.ma_phieu}</td>
                    <td className="px-3 py-2 font-semibold">{formatDateVN(row.ngay)}</td>
                    <td className="px-3 py-2 font-semibold">
                      {row.kho_nguon} <ArrowRight size={12} className="inline" /> {row.kho_dich}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {chiTiet.slice(0, 2).map(line => line.ma_sp).join(', ')}
                      {chiTiet.length > 2 ? ` (+${chiTiet.length - 2})` : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{Math.round(tongSl * 1000) / 1000}</td>
                    <td className="px-3 py-2 font-semibold">{row.nguoi_lap || '—'}</td>
                    <td className="px-3 py-2 font-bold">{trangThaiLabel(row.trang_thai)}</td>
                    <td className="px-3 py-2 text-[11px]">
                      {(() => {
                        const slips: Array<{ label: string; code: string | null }> = [
                          { label: 'Xuất', code: row.ma_phieu_xuat },
                          { label: 'Nhập', code: row.ma_phieu_nhap },
                          { label: 'Xuất hủy', code: row.ma_phieu_xuat_huy },
                          { label: 'Nhập hủy', code: row.ma_phieu_nhap_huy }
                        ].filter(item => Boolean(item.code));
                        if (slips.length === 0) return <span className="text-zinc-400">—</span>;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {slips.map(item => (
                              <span key={`${item.label}-${item.code}`} className="whitespace-nowrap">
                                <span className="font-semibold text-zinc-500">{item.label}: </span>
                                <SlipCodeButton code={item.code} label={`phiếu ${item.label.toLowerCase()}`} />
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          title="In 2 phiếu nhập + xuất"
                          onClick={() => setPrintPhieu(row)}
                          className="rounded border p-2 text-zinc-600"
                        >
                          <Printer size={14} />
                        </button>
                        {row.trang_thai === 'moi' && canEdit && (
                          <button
                            title="Sửa phiếu — chỉ khi chưa duyệt"
                            onClick={() => openEdit(row)}
                            className="rounded border p-2 text-zinc-700"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {row.trang_thai === 'moi' && canEdit && (
                          <button
                            title="Hoàn thành — sinh 2 phiếu"
                            onClick={() => void handleComplete(row.id)}
                            disabled={completingId === row.id}
                            className="rounded border border-emerald-300 p-2 font-black text-emerald-700 disabled:opacity-50"
                          >
                            {completingId === row.id ? <Loader2 size={14} className="animate-spin" /> : 'Duyệt'}
                          </button>
                        )}
                        {row.trang_thai !== 'huy' && canEdit && (
                          <button
                            title={row.trang_thai === 'hoan_thanh' ? 'Hủy — sinh 2 phiếu đảo' : 'Hủy phiếu'}
                            onClick={() => void handleCancel(row.id, row.trang_thai === 'hoan_thanh')}
                            disabled={cancellingId === row.id}
                            className="rounded border p-2 text-amber-600 disabled:opacity-50"
                          >
                            {cancellingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && !listLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center font-bold text-zinc-400">
                    {records.length === 0
                      ? 'Chưa có phiếu chuyển kho nào.'
                      : 'Không có phiếu nào khớp lọc đã chọn.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-xl bg-white">
            <div className="sticky top-0 flex items-center gap-2 border-b bg-white px-4 py-3">
              <h3 className="text-sm font-black text-zinc-900">{editingId ? 'Sửa phiếu chuyển kho' : 'Phiếu chuyển kho'}</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="ml-auto rounded border p-2 text-zinc-600"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <section className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Ngày chuyển</span>
                  <VnCalendarPicker value={ngayChuyen} onChange={setNgayChuyen} />
                  <p className="text-[11px] font-semibold text-zinc-600">{formatDateVN(ngayChuyen)}</p>
                </div>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Kho nguồn *</span>
                  <SearchableSelect
                    value={khoNguon}
                    onChange={handleKhoNguonChange}
                    options={warehouses}
                    placeholder="Chọn kho nguồn..."
                    getLabel={(item: unknown) => String(item)}
                    getValue={(item: unknown) => String(item)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Kho đích *</span>
                  <SearchableSelect
                    value={khoDich}
                    onChange={setKhoDich}
                    options={warehouses.filter(name => name !== khoNguon)}
                    placeholder="Chọn kho đích..."
                    getLabel={(item: unknown) => String(item)}
                    getValue={(item: unknown) => String(item)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Người thực hiện</span>
                  <input value={nguoiThucHien} onChange={e => setNguoiThucHien(e.target.value)} placeholder="Người trực tiếp chuyển" className={inputClass} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Người lập phiếu</span>
                  <input value={nguoiLap} onChange={e => setNguoiLap(e.target.value)} placeholder="Người lập phiếu" className={inputClass} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Ghi chú</span>
                  <input value={ghiChu} onChange={e => setGhiChu(e.target.value)} placeholder="Ghi chú" className={inputClass} />
                </label>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase text-zinc-700">
                    Sản phẩm chuyển {khoNguon ? `(tồn ${khoNguon})` : ''}
                  </h4>
                  <button
                    onClick={() => setLines(prev => [...prev, newTransferLine()])}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus size={14} /> Thêm dòng
                  </button>
                </div>
                {!khoNguon ? (
                  <p className="text-xs font-bold text-zinc-400">Chọn kho nguồn để xem tồn.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[1280px] text-left text-xs">
                      <thead className="bg-zinc-900 text-[10px] uppercase text-white">
                        <tr>
                          <th className="px-2 py-2 text-center">STT</th>
                          <th className="px-2 py-2">Mã SP *</th>
                          <th className="px-2 py-2">Tên SP *</th>
                          <th className="px-2 py-2 text-center">ĐVT</th>
                          <th className="px-2 py-2 text-center">Tồn nguồn</th>
                          <th className="px-2 py-2 text-center">SL chuyển *</th>
                          <th className="px-2 py-2 text-center">KG</th>
                          <th className="px-2 py-2 text-center">M2</th>
                          <th className="px-2 py-2 text-center">M dài</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => {
                          const view = views[index];
                          const row = view?.row || null;
                          return (
                            <tr key={line.key} className="border-t align-top">
                              <td className="px-2 py-2 text-center font-black">{index + 1}</td>
                              <td className="min-w-[150px] px-2 py-2">
                                <SearchableSelect
                                  value={line.stockKey}
                                  onChange={value => updateLine(line.key, { stockKey: value })}
                                  options={stock}
                                  placeholder={stockLoading ? 'Đang tải...' : 'Mã SP...'}
                                  isLoading={stockLoading}
                                  getLabel={(item: unknown) => {
                                    const r = item as SourceStockRow;
                                    return r.ma_sp;
                                  }}
                                  getValue={(item: unknown) => (item as SourceStockRow).key}
                                />
                              </td>
                              <td className="min-w-[260px] px-2 py-2">
                                <SearchableSelect
                                  value={line.stockKey}
                                  onChange={value => updateLine(line.key, { stockKey: value })}
                                  options={row ? stock.filter(item => item.ma_sp === row.ma_sp) : stock}
                                  placeholder={stockLoading ? 'Đang tải...' : 'Tên SP...'}
                                  isLoading={stockLoading}
                                  getLabel={(item: unknown) => {
                                    const r = item as SourceStockRow;
                                    return r.ten_sp;
                                  }}
                                  getValue={(item: unknown) => (item as SourceStockRow).key}
                                />
                                {view?.error && <p className="mt-1 font-bold text-red-600">{view.error}</p>}
                              </td>
                              <td className="px-2 py-2 text-center font-bold">{row?.don_vi || '—'}</td>
                              <td className="px-2 py-2 text-center font-bold">{row ? row.ton_sl : '—'}</td>
                              <td className="px-2 py-2">
                                <input
                                  value={line.qtyText}
                                  onChange={e => updateLine(line.key, { qtyText: e.target.value })}
                                  inputMode="decimal"
                                  className={`${cellInputClass} text-right`}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input readOnly value={view && !view.error ? fmtQty(view.kg) : ''} className={readonlyCellClass} />
                              </td>
                              <td className="px-2 py-2">
                                <input readOnly value={view && !view.error ? fmtQty(view.m2) : ''} className={readonlyCellClass} />
                              </td>
                              <td className="px-2 py-2">
                                <input readOnly value={view && !view.error ? fmtQty(view.mDai) : ''} className={readonlyCellClass} />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button
                                  title="Xóa dòng"
                                  onClick={() => removeLine(line.key)}
                                  disabled={lines.length <= 1}
                                  className="rounded border p-2 text-red-600 disabled:opacity-30"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-zinc-900 text-white">
                          <td colSpan={5} className="px-2 py-2 text-right font-black">TỔNG</td>
                          <td className="px-2 py-2 text-right font-black">{fmtQty(totals.qty)}</td>
                          <td className="px-2 py-2 text-right font-black">{totals.kg || '—'}</td>
                          <td className="px-2 py-2 text-right font-black">{totals.m2 || '—'}</td>
                          <td className="px-2 py-2 text-right font-black">{totals.mDai || '—'}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>

              {(modalError || headerError) && (
                <p className="text-xs font-bold text-red-600">{modalError || headerError}</p>
              )}

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-bold text-zinc-600"
                >
                  Đóng
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
                  {editingId ? 'Lưu sửa' : 'Lưu phiếu (Mới)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printPhieu && (
        <>
          {pendingPrint &&
            createPortal(
              <div className="dot-san-xuat-print-batch">
                <ChuyenKhoPrintSheet phieu={printPhieu} />
              </div>,
              document.body
            )}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-black">Phiếu chuyển kho {printPhieu.ma_phieu}</h3>
                <button
                  onClick={() => setPrintPhieu(null)}
                  className="ml-auto rounded border p-2"
                >
                  <X size={14} />
                </button>
              </div>
              {printPhieu.trang_thai === 'moi' && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                  Bản xem trước — phiếu đang ở trạng thái Mới nên 2 phiếu XN chưa sinh. Bấm Duyệt để sinh số phiếu.
                </p>
              )}
              <div className="dot-san-xuat-print-preview">
                <ChuyenKhoPrintSheet phieu={printPhieu} />
              </div>
              <p className="mt-2 text-xs font-semibold text-zinc-500">
                Chi tiết từng phiếu xem tại Lịch sử xuất nhập kho theo số phiếu.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setPendingPrint(true)}
                  disabled={pendingPrint}
                  className="flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                  <Printer size={14} /> {pendingPrint ? 'Đang in...' : 'In 2 phiếu'}
                </button>
                <button
                  onClick={() => setPrintPhieu(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-bold text-zinc-600"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
