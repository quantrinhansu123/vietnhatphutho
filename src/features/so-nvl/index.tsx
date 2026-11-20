import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, X, XCircle } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';
import { formatNumber, parseLocalizedNumber } from '../../utils';

/**
 * Sổ NVL có kiểm soát (phieu_nhap_kho_nvl + nhap_kho_nvl).
 * Nháp → Đã duyệt → Hủy. Duyệt phiếu xuất kiểm tồn ở server. Mã luồng chỉ là nhãn, không ràng buộc cặp mã.
 */

type LoaiPhieu = 'nhap' | 'xuat';
type TrangThai = 'nhap' | 'da_duyet' | 'huy';

interface PhieuLine {
  id?: string;
  id_danh_muc: string | null;
  ma_nvl: string;
  ten_nvl: string | null;
  ten_sx: string | null;
  don_vi: string | null;
  ten_kho: string;
  so_luong: number;
  gia: number | null;
  trong_luong_kg: number | null;
  phan_loai_nvl: string | null;
}

interface Phieu {
  id: string;
  ma_phieu: string;
  loai_phieu: LoaiPhieu;
  trang_thai: TrangThai;
  ngay_phieu: string | null;
  dot_so: string | null;
  ca: string | null;
  may: string | null;
  loai_sp_chay: string | null;
  kho_nguon: string | null;
  kho_dich: string | null;
  ma_luong: string | null;
  nguoi_lap: string | null;
  ly_do: string | null;
  ghi_chu: string | null;
  so_luong: number | null;
  trong_luong: number | null;
  gia_tri: number | null;
  lines: PhieuLine[];
}

interface MaLuong {
  ma: string;
  ten: string;
  kho_mac_dinh: string | null;
  hoat_dong: boolean;
}

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  productionName: string;
  unit: string;
  phanLoai: string;
}

interface TonRow {
  ten_kho: string;
  ma_nvl: string;
  ten_sx: string;
  ma_luong: string;
  don_vi: string | null;
  tong_nhap: string;
  tong_xuat: string;
  ton: string;
  ton_kg: string;
}

interface LuongRow {
  kho_nguon: string;
  kho_dich: string;
  loai_phieu: LoaiPhieu;
  so_phieu: number;
  tong_sl: string;
  tong_kg: string;
}

interface LuongPair {
  nguon: string;
  dich: string;
  xuatSl: number;
  xuatKg: number;
  xuatPhieu: number;
  nhanSl: number;
  nhanKg: number;
  nhanPhieu: number;
}

interface FormLine {
  key: string;
  materialId: string;
  qty: string;
  price: string;
  kg: string;
}

const LOAI_SP_OPTIONS = [
  { value: '', label: '— Không chọn —' },
  { value: 'dac', label: 'Đặc' },
  { value: 'song', label: 'Sóng' },
  { value: 'rong', label: 'Rỗng' }
];
const DOT_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));
const TRANG_THAI_LABEL: Record<TrangThai, string> = { nhap: 'Nháp', da_duyet: 'Đã duyệt', huy: 'Đã hủy' };
const TRANG_THAI_CLASS: Record<TrangThai, string> = {
  nhap: 'bg-amber-100 text-amber-800',
  da_duyet: 'bg-emerald-100 text-emerald-800',
  huy: 'bg-zinc-200 text-zinc-600'
};

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const cellInputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-right text-[13px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]';
const labelClass = 'text-[10px] font-black uppercase tracking-wide text-zinc-500';

let lineSeq = 0;
const newLine = (): FormLine => {
  lineSeq += 1;
  return { key: `l${lineSeq}`, materialId: '', qty: '', price: '', kg: '' };
};

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function monthStartISO(): string {
  return `${todayISO().slice(0, 8)}01`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Thao tác thất bại.'));
  return data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

function phanLoaiCode(label: string): string | null {
  const s = label.toLowerCase();
  if (s.includes('phụ')) return 'nvl_phu';
  if (s.includes('chính')) return 'nvl_chinh';
  return null;
}

export function SoNvlPanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit } = useTabAccess('so-nvl');
  const [view, setView] = useState<'phieu' | 'ton' | 'luong' | 'ma-luong'>('phieu');
  const [luongRows, setLuongRows] = useState<LuongRow[]>([]);

  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [machines, setMachines] = useState<Array<{ id: string; label: string }>>([]);
  const [maLuongs, setMaLuongs] = useState<MaLuong[]>([]);

  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [filterLoai, setFilterLoai] = useState('');
  const [filterTt, setFilterTt] = useState('');
  const [records, setRecords] = useState<Phieu[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Phieu | null>(null);

  const [tonKho, setTonKho] = useState('');
  const [tonRows, setTonRows] = useState<TonRow[]>([]);

  // form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loai, setLoai] = useState<LoaiPhieu>('nhap');
  const [ngay, setNgay] = useState(todayISO());
  const [dotSo, setDotSo] = useState('');
  const [ca, setCa] = useState('');
  const [may, setMay] = useState('');
  const [loaiSp, setLoaiSp] = useState('');
  const [khoNguon, setKhoNguon] = useState('');
  const [khoDich, setKhoDich] = useState('');
  const [maLuong, setMaLuong] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [lines, setLines] = useState<FormLine[]>([newLine()]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  // mã luồng form
  const [mlMa, setMlMa] = useState('');
  const [mlTen, setMlTen] = useState('');
  const [mlKho, setMlKho] = useState('');

  const activeKho = loai === 'nhap' ? khoDich : khoNguon;

  const loadRefs = useCallback(async () => {
    try {
      const [kho, may, ml] = await Promise.all([
        api<{ records?: Array<{ ten_kho?: string }> }>('/api/quan-ly-kho'),
        api<{ machines?: Array<{ ma_may?: string; ten_may?: string }> }>('/api/danh-sach-may').catch(() => ({ machines: [] })),
        api<{ records: MaLuong[] }>('/api/ma-luong-nvl').catch(() => ({ records: [] as MaLuong[] }))
      ]);
      setWarehouses(
        Array.from(new Set((kho.records || []).map(r => String(r.ten_kho ?? '').trim()).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b, 'vi')
        )
      );
      setMachines(
        (may.machines || [])
          .map(m => {
            const id = String(m.ma_may ?? '').trim();
            const ten = String(m.ten_may ?? '').trim();
            return id ? { id, label: ten ? `${id} — ${ten}` : id } : null;
          })
          .filter(Boolean) as Array<{ id: string; label: string }>
      );
      setMaLuongs(ml.records || []);
    } catch (err: any) {
      showAppToast(err?.message || 'Không tải được danh mục.', 'error');
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (filterLoai) qs.set('loai_phieu', filterLoai);
      if (filterTt) qs.set('trang_thai', filterTt);
      const data = await api<{ records: Phieu[] }>(`/api/phieu-nvl?${qs}`);
      setRecords(data.records || []);
    } catch (err: any) {
      setRecords([]);
      showAppToast(err?.message || 'Không tải được danh sách phiếu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, filterLoai, filterTt]);

  const loadLuong = useCallback(async () => {
    try {
      const data = await api<{ records: LuongRow[] }>(`/api/phieu-nvl/luong-kho?${new URLSearchParams({ from, to })}`);
      setLuongRows(data.records || []);
    } catch (err: any) {
      setLuongRows([]);
      showAppToast(err?.message || 'Không tải được luồng giữa các kho.', 'error');
    }
  }, [from, to]);

  // Gộp phiếu xuất (kho nguồn → kho đích) và phiếu nhập cùng cặp kho để đối chiếu.
  const luongPairs = useMemo<LuongPair[]>(() => {
    const map = new Map<string, LuongPair>();
    for (const r of luongRows) {
      const key = `${r.kho_nguon}\u0000${r.kho_dich}`;
      const pair =
        map.get(key) ??
        { nguon: r.kho_nguon, dich: r.kho_dich, xuatSl: 0, xuatKg: 0, xuatPhieu: 0, nhanSl: 0, nhanKg: 0, nhanPhieu: 0 };
      if (r.loai_phieu === 'xuat') {
        pair.xuatSl += Number(r.tong_sl);
        pair.xuatKg += Number(r.tong_kg);
        pair.xuatPhieu += r.so_phieu;
      } else {
        pair.nhanSl += Number(r.tong_sl);
        pair.nhanKg += Number(r.tong_kg);
        pair.nhanPhieu += r.so_phieu;
      }
      map.set(key, pair);
    }
    return Array.from(map.values()).sort((a, b) => a.nguon.localeCompare(b.nguon, 'vi') || a.dich.localeCompare(b.dich, 'vi'));
  }, [luongRows]);

  const loadTon = useCallback(async () => {
    try {
      const qs = tonKho ? `?ten_kho=${encodeURIComponent(tonKho)}` : '';
      const data = await api<{ records: TonRow[] }>(`/api/phieu-nvl/ton${qs}`);
      setTonRows(data.records || []);
    } catch (err: any) {
      setTonRows([]);
      showAppToast(err?.message || 'Không tải được tồn.', 'error');
    }
  }, [tonKho]);

  useEffect(() => void loadRefs(), [loadRefs]);
  useEffect(() => {
    if (view === 'phieu') void loadRecords();
  }, [view, loadRecords]);
  useEffect(() => {
    if (view === 'ton') void loadTon();
  }, [view, loadTon]);
  useEffect(() => {
    if (view === 'luong') void loadLuong();
  }, [view, loadLuong]);

  // NVL của đúng kho đang chọn
  useEffect(() => {
    if (!showForm || !activeKho) {
      setMaterials([]);
      return;
    }
    let cancelled = false;
    api<{ materials?: Array<Record<string, unknown>> }>(`/api/kho-nvl?ten_kho=${encodeURIComponent(activeKho)}`)
      .then(data => {
        if (cancelled) return;
        setMaterials(
          (data.materials || [])
            .map(r => ({
              id: String(r.id ?? '').trim(),
              code: String(r.ma_npl ?? '').trim(),
              name: String(r.ten_npl ?? '').trim(),
              productionName: String(r.ten_nvl_sx ?? '').trim(),
              unit: String(r.don_vi ?? '').trim(),
              phanLoai: String(r.phan_loai ?? '').trim()
            }))
            .filter(m => m.id && m.code)
        );
      })
      .catch(() => !cancelled && setMaterials([]));
    return () => {
      cancelled = true;
    };
  }, [showForm, activeKho]);

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);
  const materialLabel = (m: MaterialOption) =>
    `${m.code} — ${m.name}${m.productionName ? ` [${m.productionName}]` : ''}`;

  const resetForm = (loaiMoi: LoaiPhieu) => {
    setEditingId(null);
    setLoai(loaiMoi);
    setNgay(todayISO());
    setDotSo('');
    setCa('');
    setMay('');
    setLoaiSp('');
    setKhoNguon('');
    setKhoDich('');
    setMaLuong('');
    setNguoiLap('');
    setLyDo('');
    setGhiChu('');
    setLines([newLine()]);
    setFormError('');
  };

  const openCreate = (loaiMoi: LoaiPhieu) => {
    resetForm(loaiMoi);
    setShowForm(true);
  };

  const openEdit = (p: Phieu) => {
    if (p.trang_thai !== 'nhap') return;
    setEditingId(p.id);
    setLoai(p.loai_phieu);
    setNgay(String(p.ngay_phieu || '').slice(0, 10) || todayISO());
    setDotSo(p.dot_so || '');
    setCa(p.ca || '');
    setMay(p.may || '');
    setLoaiSp(p.loai_sp_chay || '');
    setKhoNguon(p.kho_nguon || '');
    setKhoDich(p.kho_dich || '');
    setMaLuong(p.ma_luong || '');
    setNguoiLap(p.nguoi_lap || '');
    setLyDo(p.ly_do || '');
    setGhiChu(p.ghi_chu || '');
    setLines(
      p.lines.length
        ? p.lines.map(l => {
            lineSeq += 1;
            return {
              key: `l${lineSeq}`,
              materialId: l.id_danh_muc || '',
              qty: String(l.so_luong ?? ''),
              price: l.gia == null ? '' : String(l.gia),
              kg: l.trong_luong_kg == null ? '' : String(l.trong_luong_kg)
            };
          })
        : [newLine()]
    );
    setFormError('');
    setShowForm(true);
  };

  const updateLine = (key: string, patch: Partial<FormLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const handleKhoChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    // đổi kho thì bỏ NVL đã chọn của kho cũ
    setLines(prev => prev.map(l => ({ ...l, materialId: '' })));
  };

  const handleMaLuongChange = (value: string) => {
    setMaLuong(value);
    const ml = maLuongs.find(m => m.ma === value);
    if (ml?.kho_mac_dinh) {
      const setter = loai === 'nhap' ? setKhoDich : setKhoNguon;
      if (!(loai === 'nhap' ? khoDich : khoNguon)) setter(ml.kho_mac_dinh); // chỉ gợi ý, người dùng vẫn đổi được
    }
  };

  const save = async () => {
    setFormError('');
    const payloadLines = lines
      .filter(l => l.materialId || l.qty)
      .map(l => {
        const m = materialById.get(l.materialId);
        return {
          id_danh_muc: m?.id ?? null,
          ma_nvl: m?.code ?? '',
          ten_nvl: m?.name ?? null,
          ten_sx: m?.productionName || null,
          don_vi: m?.unit || null,
          ten_kho: activeKho,
          so_luong: parseLocalizedNumber(l.qty),
          gia: l.price.trim() ? parseLocalizedNumber(l.price) : null,
          trong_luong_kg: l.kg.trim() ? parseLocalizedNumber(l.kg) : null,
          phan_loai_nvl: m ? phanLoaiCode(m.phanLoai) : null
        };
      });
    if (!activeKho) return setFormError(loai === 'nhap' ? 'Chọn kho nhập.' : 'Chọn kho xuất.');
    if (payloadLines.length === 0) return setFormError('Thêm ít nhất một dòng NVL.');
    if (payloadLines.some(l => !l.ma_nvl)) return setFormError('Có dòng chưa chọn NVL.');
    if (payloadLines.some(l => !(l.so_luong > 0))) return setFormError('Số lượng mỗi dòng phải lớn hơn 0.');

    setSaving(true);
    try {
      const body = {
        loai_phieu: loai,
        ngay_phieu: ngay,
        dot_so: dotSo,
        ca,
        may,
        loai_sp_chay: loaiSp,
        kho_nguon: khoNguon,
        kho_dich: khoDich,
        ma_luong: maLuong,
        nguoi_lap: nguoiLap,
        ly_do: lyDo,
        ghi_chu: ghiChu,
        lines: payloadLines
      };
      await api(editingId ? `/api/phieu-nvl/${editingId}` : '/api/phieu-nvl', jsonInit(editingId ? 'PUT' : 'POST', body));
      showAppToast(editingId ? 'Đã cập nhật phiếu nháp.' : 'Đã tạo phiếu nháp.');
      setShowForm(false);
      void loadRecords();
    } catch (err: any) {
      setFormError(err?.message || 'Không lưu được phiếu.');
    } finally {
      setSaving(false);
    }
  };

  const duyet = async (p: Phieu) => {
    const nguoi = window.prompt(`Người duyệt phiếu ${p.ma_phieu}:`, p.nguoi_lap || '');
    if (nguoi === null) return;
    try {
      await api(`/api/phieu-nvl/${p.id}/duyet`, jsonInit('POST', { nguoi }));
      showAppToast(`Đã duyệt ${p.ma_phieu}.`);
      void loadRecords();
    } catch (err: any) {
      showAppToast(err?.message || 'Không duyệt được phiếu.', 'error');
    }
  };

  const huy = async (p: Phieu) => {
    const lyDoHuy = window.prompt(`Lý do hủy phiếu ${p.ma_phieu}:`);
    if (!lyDoHuy || !lyDoHuy.trim()) return;
    const nguoi = window.prompt('Người hủy:', p.nguoi_lap || '');
    if (nguoi === null) return;
    try {
      await api(`/api/phieu-nvl/${p.id}/huy`, jsonInit('POST', { nguoi, ly_do: lyDoHuy.trim() }));
      showAppToast(`Đã hủy ${p.ma_phieu}.`);
      void loadRecords();
    } catch (err: any) {
      showAppToast(err?.message || 'Không hủy được phiếu.', 'error');
    }
  };

  const saveMaLuong = async () => {
    try {
      await api('/api/ma-luong-nvl', jsonInit('POST', { ma: mlMa, ten: mlTen, kho_mac_dinh: mlKho }));
      setMlMa('');
      setMlTen('');
      setMlKho('');
      showAppToast('Đã lưu mã luồng.');
      void loadRefs();
    } catch (err: any) {
      showAppToast(err?.message || 'Không lưu được mã luồng.', 'error');
    }
  };

  const khoLabel = (p: Phieu) =>
    p.loai_phieu === 'nhap' ? p.kho_dich || '—' : p.kho_nguon || '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Sổ NVL — nhập/xuất có duyệt</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Phiếu nháp → duyệt → hủy. Chỉ phiếu đã duyệt mới tính vào tồn; phiếu xuất duyệt khi đủ tồn.
          </p>
        </div>
        {canCreate && view === 'phieu' && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => openCreate('nhap')} className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-4 py-2 text-sm font-black text-white">
              <Plus size={16} /> Phiếu nhập
            </button>
            <button onClick={() => openCreate('xuat')} className="flex items-center gap-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-black text-white">
              <Plus size={16} /> Phiếu xuất
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {([['phieu', 'Phiếu'], ['ton', 'Tồn kho'], ['luong', 'Luồng kho'], ['ma-luong', 'Mã luồng']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide ${view === key ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-100 text-zinc-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'phieu' && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <span className={labelClass}>Từ ngày</span>
              <VnCalendarPicker value={from} onChange={setFrom} />
            </div>
            <div className="space-y-1">
              <span className={labelClass}>Đến ngày</span>
              <VnCalendarPicker value={to} onChange={setTo} />
            </div>
            <label className="space-y-1">
              <span className={labelClass}>Loại</span>
              <select value={filterLoai} onChange={e => setFilterLoai(e.target.value)} className={inputClass}>
                <option value="">Tất cả</option>
                <option value="nhap">Nhập</option>
                <option value="xuat">Xuất</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Trạng thái</span>
              <select value={filterTt} onChange={e => setFilterTt(e.target.value)} className={inputClass}>
                <option value="">Tất cả</option>
                <option value="nhap">Nháp</option>
                <option value="da_duyet">Đã duyệt</option>
                <option value="huy">Đã hủy</option>
              </select>
            </label>
          </div>

          <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-zinc-900 text-[11px] font-black uppercase tracking-wider text-white">
                <tr>
                  {['Mã phiếu', 'Ngày', 'Loại', 'Kho', 'Đợt', 'Máy', 'Loại SP', 'Mã luồng', 'SL', 'Kg', 'Trạng thái', ''].map(h => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-3 py-8 text-center text-zinc-500"><Loader2 className="mx-auto animate-spin" size={18} /></td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={12} className="px-3 py-8 text-center font-semibold text-zinc-500">Chưa có phiếu nào trong kỳ.</td></tr>
                ) : (
                  records.map(p => (
                    <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-2 font-black"><button className="text-[#ef1b2d] hover:underline" onClick={() => setDetail(p)}>{p.ma_phieu}</button></td>
                      <td className="px-3 py-2 font-semibold">{p.ngay_phieu ? formatDateVN(String(p.ngay_phieu).slice(0, 10)) : '—'}</td>
                      <td className="px-3 py-2 font-bold">{p.loai_phieu === 'nhap' ? 'Nhập' : 'Xuất'}</td>
                      <td className="px-3 py-2">{khoLabel(p)}</td>
                      <td className="px-3 py-2">{p.dot_so || '—'}</td>
                      <td className="px-3 py-2">{p.may || '—'}</td>
                      <td className="px-3 py-2">{LOAI_SP_OPTIONS.find(o => o.value === p.loai_sp_chay)?.label?.replace('— Không chọn —', '—') || '—'}</td>
                      <td className="px-3 py-2">{p.ma_luong || '—'}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatNumber(Number(p.so_luong || 0), 2)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(Number(p.trong_luong || 0), 2)}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${TRANG_THAI_CLASS[p.trang_thai]}`}>{TRANG_THAI_LABEL[p.trang_thai]}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {canEdit && p.trang_thai === 'nhap' && (
                            <>
                              <button title="Sửa" onClick={() => openEdit(p)} className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100"><Pencil size={15} /></button>
                              <button title="Duyệt" onClick={() => void duyet(p)} className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"><CheckCircle2 size={15} /></button>
                            </>
                          )}
                          {canEdit && p.trang_thai !== 'huy' && (
                            <button title="Hủy" onClick={() => void huy(p)} className="rounded p-1.5 text-red-600 hover:bg-red-50"><XCircle size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      {view === 'ton' && (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="block max-w-xs space-y-1">
            <span className={labelClass}>Kho</span>
            <select value={tonKho} onChange={e => setTonKho(e.target.value)} className={inputClass}>
              <option value="">Tất cả kho</option>
              {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-900 text-[11px] font-black uppercase tracking-wider text-white">
                <tr>{['Kho', 'Mã NVL', 'Tên SX', 'Mã luồng', 'ĐVT', 'Nhập', 'Xuất', 'Tồn', 'Tồn kg'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {tonRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center font-semibold text-zinc-500">Chưa có phiếu đã duyệt.</td></tr>
                ) : tonRows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-3 py-2">{r.ten_kho}</td>
                    <td className="px-3 py-2 font-bold">{r.ma_nvl}</td>
                    <td className="px-3 py-2">{r.ten_sx || '—'}</td>
                    <td className="px-3 py-2">{r.ma_luong || '—'}</td>
                    <td className="px-3 py-2">{r.don_vi || '—'}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(Number(r.tong_nhap), 2)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(Number(r.tong_xuat), 2)}</td>
                    <td className="px-3 py-2 text-right font-black">{formatNumber(Number(r.ton), 2)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(Number(r.ton_kg), 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'luong' && (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">
            Hàng chuyển giữa các kho. Phiếu xuất ghi "Xuất đến kho", phiếu nhập ghi "Nhập từ kho", chỉ tính phiếu đã duyệt.
            Chênh lệch khác 0 nghĩa là kho đích chưa nhận đủ hoặc nhận nhiều hơn số đã xuất.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><span className={labelClass}>Từ ngày</span><VnCalendarPicker value={from} onChange={setFrom} /></div>
            <div className="space-y-1"><span className={labelClass}>Đến ngày</span><VnCalendarPicker value={to} onChange={setTo} /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-900 text-[11px] font-black uppercase tracking-wider text-white">
                <tr>
                  {['Từ kho', 'Đến kho', 'Đã xuất', 'Kho đích đã nhận', 'Chênh lệch', 'Kg chênh'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {luongPairs.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center font-semibold text-zinc-500">Chưa có phiếu chuyển giữa các kho trong kỳ.</td></tr>
                ) : luongPairs.map(p => {
                  const lech = p.xuatSl - p.nhanSl;
                  const lechKg = p.xuatKg - p.nhanKg;
                  return (
                    <tr key={`${p.nguon}|${p.dich}`} className="border-t border-zinc-100">
                      <td className="px-3 py-2 font-bold">{p.nguon}</td>
                      <td className="px-3 py-2 font-bold">{p.dich}</td>
                      <td className="px-3 py-2">{formatNumber(p.xuatSl, 2)} <span className="text-xs text-zinc-500">({p.xuatPhieu} phiếu)</span></td>
                      <td className="px-3 py-2">{formatNumber(p.nhanSl, 2)} <span className="text-xs text-zinc-500">({p.nhanPhieu} phiếu)</span></td>
                      <td className={`px-3 py-2 font-black ${Math.abs(lech) < 1e-9 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {Math.abs(lech) < 1e-9 ? 'Khớp' : formatNumber(lech, 2)}
                      </td>
                      <td className="px-3 py-2">{Math.abs(lechKg) < 1e-9 ? '—' : formatNumber(lechKg, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'ma-luong' && (
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Mã luồng (MN01, SX01, HM05…) chỉ là nhãn để chọn và lọc, hệ thống không kiểm tra cặp mã.</p>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1"><span className={labelClass}>Mã</span><input value={mlMa} onChange={e => setMlMa(e.target.value.toUpperCase())} className={inputClass} placeholder="MN01" /></label>
              <label className="min-w-[220px] flex-1 space-y-1"><span className={labelClass}>Tên</span><input value={mlTen} onChange={e => setMlTen(e.target.value)} className={inputClass} /></label>
              <label className="space-y-1"><span className={labelClass}>Kho mặc định</span>
                <select value={mlKho} onChange={e => setMlKho(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <button onClick={() => void saveMaLuong()} className="h-10 rounded-lg bg-[#ef1b2d] px-4 text-sm font-black text-white">Lưu</button>
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-[11px] font-black uppercase tracking-wider text-white">
              <tr>{['Mã', 'Tên', 'Kho mặc định'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {maLuongs.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-6 text-center font-semibold text-zinc-500">Chưa có mã luồng.</td></tr>
              ) : maLuongs.map(m => (
                <tr key={m.ma} className="border-t border-zinc-100 cursor-pointer hover:bg-zinc-50" onClick={() => { setMlMa(m.ma); setMlTen(m.ten); setMlKho(m.kho_mac_dinh || ''); }}>
                  <td className="px-3 py-2 font-black">{m.ma}</td>
                  <td className="px-3 py-2">{m.ten}</td>
                  <td className="px-3 py-2">{m.kho_mac_dinh || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {detail && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-black">{detail.ma_phieu} · {detail.loai_phieu === 'nhap' ? 'Nhập' : 'Xuất'} · {TRANG_THAI_LABEL[detail.trang_thai]}</h3>
              <button onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <p className="mb-3 text-xs font-semibold text-zinc-600">
              Kho: {khoLabel(detail)} · Đợt: {detail.dot_so || '—'} · Máy: {detail.may || '—'} · Mã luồng: {detail.ma_luong || '—'} · Người lập: {detail.nguoi_lap || '—'}
              {detail.ly_do ? ` · Lý do: ${detail.ly_do}` : ''}
            </p>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-[11px] font-black uppercase text-zinc-600">
                <tr>{['Mã', 'Tên', 'Tên SX', 'ĐVT', 'SL', 'Giá', 'Kg'].map(h => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={l.id || i} className="border-t border-zinc-100">
                    <td className="px-2 py-1.5 font-bold">{l.ma_nvl}</td>
                    <td className="px-2 py-1.5">{l.ten_nvl}</td>
                    <td className="px-2 py-1.5">{l.ten_sx || '—'}</td>
                    <td className="px-2 py-1.5">{l.don_vi || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{formatNumber(Number(l.so_luong), 2)}</td>
                    <td className="px-2 py-1.5 text-right">{l.gia == null ? '—' : formatNumber(Number(l.gia), 0)}</td>
                    <td className="px-2 py-1.5 text-right">{l.trong_luong_kg == null ? '—' : formatNumber(Number(l.trong_luong_kg), 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
        document.body
      )}

      {showForm && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black">{editingId ? 'Sửa' : 'Lập'} phiếu {loai === 'nhap' ? 'nhập' : 'xuất'} NVL (nháp)</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1"><span className={labelClass}>Ngày phiếu *</span><VnCalendarPicker value={ngay} onChange={setNgay} /></div>
              <label className="space-y-1"><span className={labelClass}>{loai === 'nhap' ? 'Kho nhập *' : 'Kho xuất *'}</span>
                <SearchableSelect
                  value={loai === 'nhap' ? khoDich : khoNguon}
                  onChange={handleKhoChange(loai === 'nhap' ? setKhoDich : setKhoNguon)}
                  options={warehouses}
                  placeholder="Chọn kho..."
                  getLabel={(i: unknown) => String(i)}
                  getValue={(i: unknown) => String(i)}
                />
              </label>
              <label className="space-y-1"><span className={labelClass}>{loai === 'nhap' ? 'Nhập từ kho (nếu chuyển từ kho khác)' : 'Xuất đến kho (nếu chuyển sang kho khác)'}</span>
                <select
                  value={loai === 'nhap' ? khoNguon : khoDich}
                  onChange={e => (loai === 'nhap' ? setKhoNguon(e.target.value) : setKhoDich(e.target.value))}
                  className={inputClass}
                >
                  <option value="">— Không (nhập ngoài / xuất cho sản xuất) —</option>
                  {warehouses.filter(w => w !== activeKho).map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className={labelClass}>Mã luồng</span>
                <select value={maLuong} onChange={e => handleMaLuongChange(e.target.value)} className={inputClass}>
                  <option value="">— Không chọn —</option>
                  {maLuongs.filter(m => m.hoat_dong).map(m => <option key={m.ma} value={m.ma}>{m.ma}{m.ten ? ` — ${m.ten}` : ''}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className={labelClass}>Người lập</span><input value={nguoiLap} onChange={e => setNguoiLap(e.target.value)} className={inputClass} /></label>
              <label className="space-y-1"><span className={labelClass}>Đợt sản xuất</span>
                <select value={dotSo} onChange={e => setDotSo(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {DOT_OPTIONS.map(d => <option key={d} value={d}>Đợt {d}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className={labelClass}>Máy</span>
                <select value={may} onChange={e => setMay(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className={labelClass}>Loại SP chạy</span>
                <select value={loaiSp} onChange={e => setLoaiSp(e.target.value)} className={inputClass}>
                  {LOAI_SP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1"><span className={labelClass}>Ca</span><input value={ca} onChange={e => setCa(e.target.value)} className={inputClass} /></label>
              <label className="space-y-1 md:col-span-2"><span className={labelClass}>Lý do</span><input value={lyDo} onChange={e => setLyDo(e.target.value)} className={inputClass} /></label>
              <label className="space-y-1 md:col-span-2"><span className={labelClass}>Ghi chú</span><input value={ghiChu} onChange={e => setGhiChu(e.target.value)} className={inputClass} /></label>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-zinc-100 text-[11px] font-black uppercase text-zinc-600">
                  <tr>
                    <th className="px-2 py-1.5">NVL (theo kho đã chọn)</th>
                    <th className="px-2 py-1.5">ĐVT</th>
                    <th className="w-28 px-2 py-1.5 text-right">SL *</th>
                    <th className="w-28 px-2 py-1.5 text-right">Giá</th>
                    <th className="w-28 px-2 py-1.5 text-right">Kg</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const m = materialById.get(l.materialId);
                    return (
                      <tr key={l.key} className="border-t border-zinc-100">
                        <td className="min-w-[280px] px-2 py-1.5">
                          <SearchableSelect
                            value={l.materialId}
                            onChange={v => updateLine(l.key, { materialId: v })}
                            options={materials}
                            placeholder={activeKho ? 'Chọn NVL...' : 'Chọn kho trước...'}
                            disabled={!activeKho}
                            getLabel={(i: unknown) => materialLabel(i as MaterialOption)}
                            getValue={(i: unknown) => (i as MaterialOption).id}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-semibold text-zinc-600">{m?.unit || '—'}</td>
                        <td className="px-2 py-1.5"><input value={l.qty} onChange={e => updateLine(l.key, { qty: e.target.value })} className={cellInputClass} inputMode="decimal" /></td>
                        <td className="px-2 py-1.5"><input value={l.price} onChange={e => updateLine(l.key, { price: e.target.value })} className={cellInputClass} inputMode="decimal" /></td>
                        <td className="px-2 py-1.5"><input value={l.kg} onChange={e => updateLine(l.key, { kg: e.target.value })} className={cellInputClass} inputMode="decimal" /></td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => setLines(prev => (prev.length > 1 ? prev.filter(x => x.key !== l.key) : prev))} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button onClick={() => setLines(prev => [...prev, newLine()])} className="mt-2 flex items-center gap-1 text-xs font-black text-[#ef1b2d]"><Plus size={14} /> Thêm dòng</button>
            </div>

            {formError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{formError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700">Đóng</button>
              <button onClick={() => void save()} disabled={saving} className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-5 py-2 text-sm font-black text-white disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} Lưu nháp
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
