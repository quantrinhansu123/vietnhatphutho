import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { useTabAccess } from '../../app/useTabAccess';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';
import { orderFieldClass } from '../_shared/orderHelpers';
import { normalizeCatLeSanPhamList, type CatLeSanPhamLine } from '../lenh-cat-le/logic';

type PieceDraft = {
  maAmis: string;
  maAmisCu: string;
  tenSanPham: string;
  tenSanXuat: string;
  sl: string;
  trongLuong: string;
  m2: string;
};

type ReportLine = {
  key: string;
  lenhId: string;
  maLenh: string;
  amisCode: string;
  maAmisCu: string;
  tenSanPham: string;
  productionName: string;
  unit: string;
  dai: string;
  doLiDm: string;
  slTong: string;
  tongKg: string;
  ghiChu: string;
  cut: PieceDraft;
  rest: PieceDraft;
};

type ReportRow = {
  id: string;
  ma_bao_cao: string;
  ngay: string;
  ma_lenh: string | null;
  nguoi_lap: string | null;
  ghi_chu: string | null;
  san_pham: ReportLine[];
};

type LenhOption = {
  id: string;
  ma_lenh: string;
  ngay_cat: string;
  nguoi_lap: string | null;
  products: CatLeSanPhamLine[];
};

const GRID =
  'grid-cols-[9.5rem_minmax(9rem,1fr)_minmax(12rem,1.4fr)_4.5rem_5rem_6rem_5rem_6.5rem_minmax(8rem,1fr)]';
const PIECE_GRID =
  'grid-cols-[5.5rem_minmax(9rem,0.9fr)_minmax(10rem,1.1fr)_minmax(14rem,1.6fr)_5rem_7rem_6.5rem]';
const fieldClass = `${orderFieldClass} px-2`;

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function emptyPiece(): PieceDraft {
  return { maAmis: '', maAmisCu: '', tenSanPham: '', tenSanXuat: '', sl: '', trongLuong: '', m2: '' };
}

function numText(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return String(Math.round(n * 1000) / 1000);
}

let lineSeq = 0;
function nextKey(): string {
  lineSeq += 1;
  return `bcl-${Date.now()}-${lineSeq}`;
}

function pieceFromCat(
  code: string,
  oldCode: string,
  productName: string,
  productionName: string,
  qty: number,
  kg: number,
  m2: number
): PieceDraft {
  return {
    maAmis: code,
    maAmisCu: oldCode,
    tenSanPham: productName,
    tenSanXuat: productionName,
    sl: numText(qty),
    trongLuong: numText(kg),
    m2: numText(m2)
  };
}

function lineFromLenh(lenh: LenhOption, item: CatLeSanPhamLine): ReportLine {
  const nguon = item.san_pham_nguon;
  const cat = item.san_pham_cat_1;
  const rest = item.san_pham_cat_2;
  const productName = String(nguon.ten_goc || '').trim();
  const sourceCode = String(nguon.ma_amis || nguon.ma_sp || '').trim();
  const sourceOldCode = String(nguon.ma_amis_cu || '').trim();
  return {
    key: nextKey(),
    lenhId: lenh.id,
    maLenh: lenh.ma_lenh,
    amisCode: sourceCode,
    maAmisCu: sourceOldCode,
    tenSanPham: productName,
    productionName: String(nguon.ten_sp || '').trim(),
    unit: String(nguon.don_vi || 'Tấm').trim(),
    dai: numText(cat.m_dai) || String(cat.do_dai_m || '').replace(/\s*m\s*$/iu, ''),
    doLiDm: String(cat.do_li_dm || nguon.do_li_dm || '').trim(),
    slTong: numText(item.so_luong_cat_1) || numText(nguon.so_luong),
    tongKg: numText((Number(cat.kg) || 0) * (Number(item.so_luong_cat_1) || 0)),
    ghiChu: String(item.ghi_chu || '').trim(),
    cut: pieceFromCat(
      String(cat.ma_amis || '').trim(),
      String(cat.ma_amis_cu || sourceCode).trim(),
      productName,
      String(cat.ten_sp || '').trim(),
      Number(item.so_luong_cat_1) || 0,
      Number(cat.kg) || 0,
      Number(cat.m2) || 0
    ),
    rest: rest
      ? pieceFromCat(
          String(rest.ma_amis || '').trim(),
          String(rest.ma_amis_cu || sourceCode).trim(),
          productName,
          String(rest.ten_sp || '').trim(),
          Number(nguon.so_luong) || 0,
          Number(rest.kg) || 0,
          Number(rest.m2) || 0
        )
      : { ...emptyPiece(), maAmisCu: sourceCode }
  };
}

function PieceEditor({
  label,
  tone,
  value,
  onChange
}: {
  label: string;
  tone: 'cut' | 'rest';
  value: PieceDraft;
  onChange: (patch: Partial<PieceDraft>) => void;
}) {
  const toneClass = tone === 'cut' ? 'text-emerald-800' : 'text-amber-800';
  return (
    <div className={`${PIECE_GRID} items-center gap-2 px-2 py-1.5`}>
      <span className={`text-[11px] font-black ${toneClass}`}>{label}</span>
      <input value={value.maAmis} onChange={e => onChange({ maAmis: e.target.value })} className={fieldClass} placeholder="Mã AMIS" />
      <input value={value.tenSanPham} onChange={e => onChange({ tenSanPham: e.target.value })} className={fieldClass} placeholder="Tên sản phẩm" />
      <input value={value.tenSanXuat} onChange={e => onChange({ tenSanXuat: e.target.value })} className={fieldClass} placeholder="Tên sản xuất" />
      <input value={value.sl} onChange={e => onChange({ sl: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right`} placeholder="SL" />
      <input value={value.trongLuong} onChange={e => onChange({ trongLuong: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right`} placeholder="kg" />
      <input value={value.m2} onChange={e => onChange({ m2: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right`} placeholder="m²" />
    </div>
  );
}

export function BaoCaoDonCatLePanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('bao-cao-don-cat-le');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [ngay, setNgay] = useState(todayISO());
  const [nguoiLap, setNguoiLap] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [showAutofill, setShowAutofill] = useState(false);
  const [lenhOptions, setLenhOptions] = useState<LenhOption[]>([]);
  const [lenhLoading, setLenhLoading] = useState(false);
  const [lenhDate, setLenhDate] = useState(todayISO());
  const [lenhSearch, setLenhSearch] = useState('');
  const [pickedLenhId, setPickedLenhId] = useState('');
  const [pickedKeys, setPickedKeys] = useState<string[]>([]);

  const loadRows = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch('/api/bao-cao-don-cat-le');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được báo cáo.'));
      const records = Array.isArray(data.records) ? data.records : [];
      setRows(
        records.map((row: ReportRow) => ({
          ...row,
          san_pham: Array.isArray(row.san_pham) ? row.san_pham : []
        }))
      );
    } catch (err: unknown) {
      setRows([]);
      setListError(err instanceof Error ? err.message : 'Không tải được báo cáo.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openCreate = () => {
    setEditingId('');
    setNgay(todayISO());
    setNguoiLap('');
    setGhiChu('');
    setLines([]);
    setOpenKeys({});
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (row: ReportRow) => {
    setEditingId(row.id);
    setNgay(String(row.ngay || '').slice(0, 10) || todayISO());
    setNguoiLap(row.nguoi_lap || '');
    setGhiChu(row.ghi_chu || '');
    const next = (row.san_pham || []).map(line => ({
      ...line,
      key: line.key || nextKey(),
      maAmisCu: line.maAmisCu || '',
      tenSanPham: line.tenSanPham || line.cut?.tenSanPham || '',
      cut: { ...emptyPiece(), ...line.cut },
      rest: { ...emptyPiece(), ...line.rest }
    }));
    setLines(next);
    setOpenKeys(Object.fromEntries(next.map(line => [line.key, true])));
    setModalError('');
    setShowModal(true);
  };

  const openAutofill = async () => {
    setShowAutofill(true);
    setLenhDate(ngay);
    setLenhSearch('');
    setPickedLenhId('');
    setPickedKeys([]);
    setLenhLoading(true);
    try {
      const res = await fetch('/api/lenh-cat-le');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được lệnh cắt lẻ.'));
      const records = Array.isArray(data.records) ? data.records : [];
      setLenhOptions(
        records.map((row: { id: string; ma_lenh: string; ngay_cat: string; nguoi_lap?: string | null; san_pham?: unknown }) => ({
          id: row.id,
          ma_lenh: row.ma_lenh,
          ngay_cat: String(row.ngay_cat || '').slice(0, 10),
          nguoi_lap: row.nguoi_lap || null,
          products: normalizeCatLeSanPhamList(row.san_pham)
        }))
      );
    } catch (err: unknown) {
      setLenhOptions([]);
      showAppToast(err instanceof Error ? err.message : 'Không tải được lệnh cắt lẻ.', 'error');
    } finally {
      setLenhLoading(false);
    }
  };

  const filteredLenh = useMemo(() => {
    const day = lenhDate.trim();
    const q = lenhSearch.trim().toLocaleLowerCase('vi');
    return lenhOptions.filter(lenh => {
      if (day && lenh.ngay_cat && lenh.ngay_cat !== day) return false;
      if (!q) return true;
      const hay = [lenh.ma_lenh, lenh.nguoi_lap, ...lenh.products.flatMap(item => [item.san_pham_nguon.ma_sp, item.san_pham_nguon.ten_sp, item.san_pham_cat_1.ten_sp])]
        .join(' ')
        .toLocaleLowerCase('vi');
      return hay.includes(q);
    });
  }, [lenhDate, lenhOptions, lenhSearch]);

  const pickedLenh = filteredLenh.find(lenh => lenh.id === pickedLenhId) || lenhOptions.find(lenh => lenh.id === pickedLenhId) || null;

  const applyAutofill = () => {
    if (!pickedLenh) {
      setModalError('Chọn một lệnh cắt lẻ.');
      return;
    }
    const chosen = pickedLenh.products
      .map((item, index) => ({ item, key: `${pickedLenh.id}::${index}` }))
      .filter(entry => pickedKeys.includes(entry.key));
    if (chosen.length === 0) {
      setModalError('Tick ít nhất một sản phẩm trong lệnh.');
      return;
    }
    const next = chosen.map(entry => lineFromLenh(pickedLenh, entry.item));
    setLines(next);
    setOpenKeys({});
    if (!nguoiLap.trim() && pickedLenh.nguoi_lap) setNguoiLap(pickedLenh.nguoi_lap);
    setModalError('');
    setShowAutofill(false);
  };

  const patchLine = (key: string, patch: Partial<ReportLine>) => {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const patchPiece = (key: string, which: 'cut' | 'rest', patch: Partial<PieceDraft>) => {
    setLines(prev =>
      prev.map(line => (line.key === key ? { ...line, [which]: { ...line[which], ...patch } } : line))
    );
  };

  const save = async () => {
    if (lines.length === 0) {
      setModalError('Hãy tự điền ít nhất một sản phẩm từ lệnh cắt lẻ.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const maLenh = [...new Set(lines.map(line => line.maLenh).filter(Boolean))].join(', ');
      const payload = {
        ngay,
        maLenh,
        nguoiLap: nguoiLap.trim(),
        ghiChu: ghiChu.trim(),
        sanPham: lines
      };
      const res = await fetch(editingId ? `/api/bao-cao-don-cat-le/${encodeURIComponent(editingId)}` : '/api/bao-cao-don-cat-le', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không lưu được báo cáo.'));
      showAppToast(editingId ? 'Đã lưu sửa báo cáo.' : 'Đã lưu báo cáo đơn cắt lẻ.');
      setShowModal(false);
      await loadRows();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Không lưu được báo cáo.');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id: string) => {
    if (!window.confirm('Xóa báo cáo này?')) return;
    try {
      const res = await fetch(`/api/bao-cao-don-cat-le/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không xóa được báo cáo.'));
      showAppToast('Đã xóa báo cáo.');
      await loadRows();
    } catch (err: unknown) {
      showAppToast(err instanceof Error ? err.message : 'Không xóa được báo cáo.', 'error');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Báo cáo đơn cắt lẻ</h2>
          <p className="text-xs font-semibold text-zinc-500">Tự điền từ lệnh cắt lẻ. Danh sách mở dòng cắt và phần thừa để sửa.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-4 py-2 text-xs font-black text-white">
            <Plus size={14} /> Tạo mới
          </button>
        )}
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b px-3 py-2 text-xs font-black uppercase text-zinc-600">
          Danh sách báo cáo {listLoading ? '(đang tải...)' : `(${rows.length})`}
        </div>
        {listError ? <p className="px-3 py-2 text-xs font-bold text-red-600">{listError}</p> : null}
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Mã báo cáo</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Lệnh cắt lẻ</th>
                <th className="px-3 py-2 text-right">Số SP</th>
                <th className="px-3 py-2">Người lập</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-black">{row.ma_bao_cao}</td>
                  <td className="px-3 py-2 font-semibold">{formatDateVN(row.ngay)}</td>
                  <td className="px-3 py-2 font-semibold">{row.ma_lenh || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold">{row.san_pham?.length || 0}</td>
                  <td className="px-3 py-2 font-semibold">{row.nguoi_lap || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <button type="button" title="Sửa" onClick={() => openEdit(row)} className="rounded border px-2 py-1 text-[11px] font-black text-zinc-700">
                          <Pencil size={14} className="inline" /> Sửa
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" title="Xóa" onClick={() => void removeRow(row.id)} className="rounded border p-2 text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-bold text-zinc-400">Chưa có báo cáo đơn cắt lẻ.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-sm">
          <div className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">{editingId ? 'Sửa báo cáo đơn cắt lẻ' : 'Thêm báo cáo đơn cắt lẻ'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="ml-auto rounded border p-2 text-zinc-600"><X size={14} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              <section className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Ngày báo cáo</span>
                  <VnCalendarPicker value={ngay} onChange={setNgay} />
                  <p className="text-[11px] font-semibold text-zinc-600">{formatDateVN(ngay)}</p>
                </div>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Người lập</span>
                  <input value={nguoiLap} onChange={e => setNguoiLap(e.target.value)} className={orderFieldClass} placeholder="Người lập báo cáo" />
                </label>
              </section>

              <div className="overflow-x-auto">
                <div className="min-w-[1280px]">
                  <RepeatableLinesBlock
                    title="Sản phẩm"
                    required
                    showColumnHeaders
                    alwaysShowColumnHeaders
                    hideAddButton
                    linesClassName="flex flex-col gap-2"
                    gridTemplateClass={GRID}
                    onAdd={() => undefined}
                    extraHeaderButtons={
                      <button type="button" onClick={() => void openAutofill()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/25 bg-red-50 px-3 text-[11px] font-extrabold text-[#ef1b2d]">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Tự điền từ lệnh cắt lẻ
                      </button>
                    }
                    columns={[
                      { key: 'stt', label: 'STT' },
                      { key: 'code', label: 'Mã AMIS', required: true },
                      { key: 'name', label: 'Tên sản xuất' },
                      { key: 'unit', label: 'ĐVT' },
                      { key: 'dai', label: 'Dài (m)' },
                      { key: 'doli', label: 'Độ li ĐM' },
                      { key: 'sl', label: 'SL' },
                      { key: 'kg', label: 'Tổng KG' },
                      { key: 'note', label: 'Ghi chú' }
                    ]}
                  >
                    {lines.length === 0 ? (
                      <p className="px-1 py-3 text-xs font-semibold text-zinc-500">Bấm Tự điền từ lệnh cắt lẻ để lấy sản phẩm.</p>
                    ) : lines.map((line, index) => {
                      const open = Boolean(openKeys[line.key]);
                      return (
                        <div key={line.key} className="space-y-1">
                          <RepeatableLineRow gridTemplateClass={GRID} className="!py-2">
                            <div className="flex h-11 items-center gap-1.5">
                              <span className="w-4 shrink-0 text-xs font-black tabular-nums text-zinc-500">{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => setOpenKeys(prev => ({ ...prev, [line.key]: !prev[line.key] }))}
                                className={`h-8 min-w-0 flex-1 rounded-lg border px-1.5 text-[10px] font-black whitespace-nowrap ${open ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-sky-300 bg-sky-50 text-sky-800'}`}
                              >
                                {open ? 'Ẩn' : 'Danh sách'}
                              </button>
                            </div>
                            <input value={line.amisCode} onChange={e => patchLine(line.key, { amisCode: e.target.value })} className={fieldClass} />
                            <input value={line.productionName} onChange={e => patchLine(line.key, { productionName: e.target.value })} className={fieldClass} />
                            <input value={line.unit} onChange={e => patchLine(line.key, { unit: e.target.value })} className={`${fieldClass} text-center`} />
                            <input value={line.dai} onChange={e => patchLine(line.key, { dai: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right`} />
                            <input value={line.doLiDm} onChange={e => patchLine(line.key, { doLiDm: e.target.value })} className={`${fieldClass} text-right`} />
                            <input value={line.slTong} onChange={e => patchLine(line.key, { slTong: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right font-black`} />
                            <input value={line.tongKg} onChange={e => patchLine(line.key, { tongKg: e.target.value })} onWheel={e => e.currentTarget.blur()} inputMode="decimal" className={`${fieldClass} text-right`} />
                            <input value={line.ghiChu} onChange={e => patchLine(line.key, { ghiChu: e.target.value })} className={fieldClass} />
                          </RepeatableLineRow>
                          {open ? (
                            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50">
                              <div className="min-w-[980px]">
                                <div className={`${PIECE_GRID} gap-2 border-b border-zinc-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500`}>
                                  <span />
                                  <span>Mã AMIS</span>
                                  <span>Tên sản phẩm</span>
                                  <span>Tên sản xuất</span>
                                  <span className="text-right">SL</span>
                                  <span className="text-right">Trọng lượng</span>
                                  <span className="text-right">m²</span>
                                </div>
                                <PieceEditor label="Cắt" tone="cut" value={line.cut} onChange={patch => patchPiece(line.key, 'cut', patch)} />
                                <PieceEditor label="Còn lại" tone="rest" value={line.rest} onChange={patch => patchPiece(line.key, 'rest', patch)} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </RepeatableLinesBlock>
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Ghi chú</span>
                <input value={ghiChu} onChange={e => setGhiChu(e.target.value)} className={orderFieldClass} placeholder="Ghi chú báo cáo" />
              </label>
              {modalError ? <p className="text-xs font-bold text-red-600">{modalError}</p> : null}
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-bold text-zinc-600">Hủy</button>
                <button type="button" onClick={() => void save()} disabled={saving || (!editingId && !canCreate) || (Boolean(editingId) && !canEdit)} className="inline-flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-5 py-2 text-sm font-black text-white disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {editingId ? 'Lưu sửa' : 'Lưu báo cáo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAutofill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-sm">
          <div className="flex h-[86dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider">Tự điền từ lệnh cắt lẻ</h4>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Chọn lệnh, tick sản phẩm. Danh sách sẽ mở dòng cắt và phần thừa để sửa.</p>
              </div>
              <button type="button" onClick={() => setShowAutofill(false)} className="h-9 rounded-lg border px-3 text-xs font-bold text-zinc-600">Đóng</button>
            </div>
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end">
              <label className="space-y-1.5 sm:w-48">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ngày lệnh</span>
                <VnCalendarPicker value={lenhDate} onChange={setLenhDate} />
              </label>
              <label className="min-w-0 flex-1 space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Tìm lệnh / mã hàng</span>
                <input value={lenhSearch} onChange={e => setLenhSearch(e.target.value)} placeholder="Mã lệnh, mã hàng..." className={orderFieldClass} />
              </label>
              {lenhDate ? (
                <button type="button" onClick={() => setLenhDate('')} className="h-10 rounded-lg border px-3 text-xs font-bold text-zinc-600">Tất cả ngày</button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
              {lenhLoading ? <p className="text-xs font-semibold text-zinc-500">Đang tải lệnh cắt lẻ...</p> : null}
              {!lenhLoading && filteredLenh.length === 0 ? <p className="text-xs font-semibold text-zinc-500">Không có lệnh cắt lẻ trong bộ lọc này.</p> : null}
              <div className="space-y-2">
                {filteredLenh.map(lenh => (
                  <label key={lenh.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                    <input
                      type="radio"
                      name="bao-cao-lenh"
                      checked={pickedLenhId === lenh.id}
                      onChange={() => {
                        setPickedLenhId(lenh.id);
                        setPickedKeys(lenh.products.map((_, index) => `${lenh.id}::${index}`));
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-black text-zinc-900">{lenh.ma_lenh}</span>
                      <span className="block text-xs font-semibold text-zinc-500">{formatDateVN(lenh.ngay_cat)} · {lenh.products.length} sản phẩm</span>
                    </span>
                  </label>
                ))}
              </div>
              {pickedLenh && pickedLenh.products.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-black uppercase text-zinc-600">Sản phẩm trong {pickedLenh.ma_lenh}</div>
                  {pickedLenh.products.map((item, index) => {
                    const key = `${pickedLenh.id}::${index}`;
                    const checked = pickedKeys.includes(key);
                    return (
                      <label key={key} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setPickedKeys(prev => (prev.includes(key) ? prev.filter(itemKey => itemKey !== key) : [...prev, key]))}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-black">{item.san_pham_nguon.ma_amis || item.san_pham_nguon.ma_sp}</span>
                          <span className="block text-xs font-semibold text-zinc-600">{item.san_pham_nguon.ten_sp}</span>
                          <span className="block text-xs font-semibold text-emerald-800">Cắt: {item.san_pham_cat_1.ten_sp}</span>
                          <span className="block text-xs font-semibold text-amber-800">{item.san_pham_cat_2 ? `Còn lại: ${item.san_pham_cat_2.ten_sp}` : 'Còn lại: không còn — vẫn mở ô để sửa'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t bg-zinc-50 px-4 py-3">
              <button type="button" onClick={() => setShowAutofill(false)} className="h-10 rounded-xl border bg-white px-4 text-xs font-bold text-zinc-600">Hủy</button>
              <button type="button" onClick={applyAutofill} className="h-10 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white">Điền vào báo cáo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
