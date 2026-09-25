import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, Printer, Trash2 } from 'lucide-react';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import {
  formatWarehouseShiftSelection,
  parseWarehouseShiftSelection,
  toggleWarehouseShiftSelection
} from '../phieu-xuat-nhap-kho';
import { validateWarehouseShiftsSameLoaiCa } from '../phieu-xuat-nhap-kho/nvlSlipLogic';
import { getProductionShiftOptions, normalizeShiftSettings } from '../../utils/shiftSettings';
import { convertWarehouseQuantityToKg, formatWarehouseWeightKg } from '../../utils/warehouseWeight';
import { formatTongHopDate, isNvlWarehouseName, takePendingTongHopEdit, type TongHopHeader, type TongHopMode } from './model';

type Mode = TongHopMode;
type Option = { id: string; label: string; kind: 'kho' | 'may' | 'ncc'; vatTu?: boolean };

type Line = {
  key: string;
  /** Nhập: kho hoặc nhà cung cấp. Xuất: kho hoặc máy. */
  sourceLoai: 'kho' | 'ncc' | 'may';
  khoId: string;
  maHang: string;
  tenHang: string;
  donVi: string;
  soLuong: string;
  donGia: string;
  ton: number | null;
};

const emptyLine = (): Line => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sourceLoai: 'kho',
  khoId: '',
  maHang: '',
  tenHang: '',
  donVi: '',
  soLuong: '',
  donGia: '',
  ton: null
});

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function TongHopPanel({ onBack, onOpenList }: { onBack: () => void; onOpenList: () => void }) {
  const [mode, setMode] = useState<Mode>('nhap');
  const [ngay, setNgay] = useState(todayIso());
  const [cas, setCas] = useState<string[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ReturnType<typeof normalizeShiftSettings>>([]);
  const fieldClass = 'h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [machines, setMachines] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<Array<{ code: string; name: string; unit: string; totalWeight: string }>>([]);
  const [products, setProducts] = useState<Array<{ code: string; name: string; unit: string; tenKho: string; totalWeight: string }>>([]);
  const [nguonLoai, setNguonLoai] = useState<'kho' | 'ncc'>('kho');
  const [nguonId, setNguonId] = useState('');
  const [dichLoai, setDichLoai] = useState<'kho' | 'may'>('kho');
  const [dichId, setDichId] = useState('');
  const [loaiNhap, setLoaiNhap] = useState('');
  const [loaiXuat, setLoaiXuat] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [nguoiGiao, setNguoiGiao] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [staff, setStaff] = useState<Array<{ id: string; label: string }>>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  const dest = useMemo(() => {
    const pool = dichLoai === 'may' ? machines : warehouses;
    return pool.find(item => item.id === dichId) || null;
  }, [dichId, dichLoai, machines, warehouses]);

  useEffect(() => {
    const load = async () => {
      const [khoRes, mayRes, nccRes, caRes, nvlRes, spRes, nsRes] = await Promise.all([
        fetch('/api/quan-ly-kho').then(r => r.json()).catch(() => ({})),
        fetch('/api/danh-sach-may').then(r => r.json()).catch(() => ({})),
        fetch('/api/nha-cung-cap').then(r => r.json()).catch(() => ({})),
        fetch('/api/cai-dat').then(r => r.json()).catch(() => ({})),
        fetch('/api/kho-nvl').then(r => r.json()).catch(() => ({})),
        fetch('/api/nhap-kho').then(r => r.json()).catch(() => ({})),
        fetch('/api/nhan-su?format=groups&scope=all').then(r => r.json()).catch(() => ({}))
      ]);
      const khoRows = Array.isArray(khoRes.records) ? khoRes.records : [];
      setWarehouses(
        khoRows
          .map((row: Record<string, unknown>) => {
            const ten = String(row.ten_kho ?? '').trim();
            return ten ? { id: ten, label: ten, kind: 'kho' as const, vatTu: isNvlWarehouseName(ten) } : null;
          })
          .filter(Boolean) as Option[]
      );
      const mayRows = Array.isArray(mayRes.machines) ? mayRes.machines : [];
      setMachines(
        mayRows
          .map((row: Record<string, unknown>) => {
            const id = String(row.ma_may ?? '').trim();
            const ten = String(row.ten_may ?? '').trim();
            return id ? { id, label: ten ? `${id} — ${ten}` : id, kind: 'may' as const, vatTu: true } : null;
          })
          .filter(Boolean) as Option[]
      );
      const nccRows = Array.isArray(nccRes.suppliers) ? nccRes.suppliers : Array.isArray(nccRes.records) ? nccRes.records : [];
      setSuppliers(
        nccRows
          .map((row: Record<string, unknown>) => {
            const id = String(row.ma_nha_cung_cap ?? row.id ?? '').trim();
            const ten = String(row.ten_nha_cung_cap ?? '').trim();
            return id ? { id, label: ten ? `${id} — ${ten}` : id, kind: 'ncc' as const } : null;
          })
          .filter(Boolean) as Option[]
      );
      setShiftSettings(normalizeShiftSettings(caRes));
      const nvlRows = Array.isArray(nvlRes.materials) ? nvlRes.materials : Array.isArray(nvlRes.records) ? nvlRes.records : [];
      setMaterials(
        nvlRows
          .map((row: Record<string, unknown>) => ({
            code: String(row.ma_npl ?? '').trim(),
            name: String(row.ten_npl ?? '').trim(),
            unit: String(row.don_vi ?? '').trim(),
            totalWeight: String(row.tong_trong_luong ?? '').trim()
          }))
          .filter((row: { code: string }) => row.code)
      );
      const spRows = Array.isArray(spRes.records) ? spRes.records : [];
      setProducts(
        spRows
          .filter((row: Record<string, unknown>) => !String(row.ma_may ?? '').trim())
          .map((row: Record<string, unknown>) => ({
            code: String(row.ma_sp ?? '').trim(),
            name: String(row.ten_sp ?? '').trim(),
            unit: String(row.don_vi ?? '').trim(),
            tenKho: String(row.ten_kho ?? '').trim(),
            totalWeight: String(row.trong_luong_kg_mot_sp ?? row.tong_trong_luong ?? '').trim()
          }))
          .filter((row: { code: string }) => row.code)
      );
      const branches = Array.isArray(nsRes.branches) ? nsRes.branches : [];
      const people = new Map<string, { id: string; label: string }>();
      for (const branch of branches) {
        const departments = Array.isArray(branch?.departments) ? branch.departments : [];
        for (const department of departments) {
          const members = Array.isArray(department?.members) ? department.members : [];
          for (const member of members) {
            const name = String(member?.name || '').trim();
            const status = String(member?.status || '').trim();
            if (!name || status !== 'Đang làm') continue;
            const code = String(member?.code || name).trim();
            people.set(code, { id: name, label: code && code !== name ? `${code} — ${name}` : name });
          }
        }
      }
      setStaff([...people.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi')));
    };
    void load();
  }, []);

  function patchLine(index: number, patch: Partial<Line>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function itemsFor(kho: Option | null | undefined) {
    if (!kho) return [];
    if (kho.vatTu || kho.kind === 'may') {
      return materials.map(item => ({ id: item.code, label: `${item.code} — ${item.name}`, name: item.name, unit: item.unit }));
    }
    return products
      .filter(item => !kho.id || item.tenKho === kho.id || kho.kind === 'may')
      .map(item => ({ id: item.code, label: `${item.code} — ${item.name}`, name: item.name, unit: item.unit }));
  }

  async function refreshTon(index: number, line: Line) {
    const fromMay = mode === 'xuat' && dichLoai === 'may';
    const khoTon = mode === 'nhap' ? (nguonLoai === 'kho' ? nguonId : '') : dichId;
    if (!line.maHang || !khoTon) {
      patchLine(index, { ton: null });
      return;
    }
    const kho = warehouses.find(item => item.id === khoTon);
    const params = new URLSearchParams({
      ma_hang: line.maHang,
      catalog: fromMay || kho?.vatTu ? 'nvl' : 'san_pham'
    });
    if (fromMay) params.set('ma_may', khoTon);
    else params.set('ten_kho', khoTon);
    const res = await fetch(`/api/xuat-nhap-tong-hop/ton?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) patchLine(index, { ton: Number(data.ton) || 0 });
  }

  const shiftError = validateWarehouseShiftsSameLoaiCa(cas, shiftSettings);
  const warning = !shiftError && cas.length === 0 && mode === 'xuat' && (dichLoai === 'may' || dest?.vatTu || lines.some(line => line.sourceLoai === 'may'))
    ? 'Xuất NVL tới máy hoặc kho NVL nên có ca để sổ trộn tính Nhập Trong Ngày. Vẫn lưu được nếu để trống.'
    : '';

  function resetLines() {
    setLines([emptyLine()]);
    setEditingId(null);
    setEditingCode('');
    setNguonId('');
    setDichId('');
    setCas([]);
    setLoaiNhap('');
    setLoaiXuat('');
    setNguoiLap('');
    setNguoiGiao('');
    setDiaDiem('');
    setLyDo('');
    setGhiChu('');
    setError('');
  }

  function buildPayload() {
    return {
      loai: mode,
      ngay,
      ca: mode === 'xuat' ? formatWarehouseShiftSelection(cas) : '',
      ca_list: mode === 'xuat' ? cas : [],
      nguon_loai: mode === 'nhap' ? nguonLoai : dichLoai,
      nguon_id: mode === 'nhap' ? nguonId : dichId,
      dich_loai: null,
      dich_id: null,
      loai_nhap: mode === 'nhap' ? loaiNhap : null,
      loai_xuat: mode === 'xuat' ? loaiXuat : null,
      nguoi_lap: nguoiLap,
      nguoi_giao: nguoiGiao,
      dia_diem: diaDiem,
      ly_do: lyDo,
      ghi_chu: ghiChu,
      lines: lines.map(line => ({
        ma_hang: line.maHang,
        ten_hang: line.tenHang,
        don_vi: line.donVi,
        so_luong: line.soLuong,
        don_gia: line.donGia,
        quy_doi_kg: lineWeight(line),
        kho_dong: mode === 'nhap' || (mode === 'xuat' && line.sourceLoai === 'kho') ? line.khoId : '',
        dich_dong_loai: mode === 'xuat' ? line.sourceLoai : '',
        dich_dong_id: mode === 'xuat' ? line.khoId : ''
      }))
    };
  }

  async function onSave() {
    setError('');
    setInfo('');
    if (shiftError) {
      setError(shiftError);
      return;
    }
    if (mode === 'nhap' && !nguonId) {
      setError('Chọn nguồn nhập (kho hoặc nhà cung cấp).');
      return;
    }
    if (mode === 'xuat' && !dichId) {
      setError('Chọn nguồn xuất (kho hoặc máy).');
      return;
    }
    if (lines.some(line => !line.khoId)) {
      setError(mode === 'nhap' ? 'Mỗi dòng cần chọn kho nhập.' : 'Mỗi dòng cần chọn nơi xuất đến.');
      return;
    }
    if (mode === 'xuat' || mode === 'nhap') {
      for (const line of lines) {
        const qty = Number(String(line.soLuong).replace(',', '.'));
        if (mode === 'nhap' && nguonLoai === 'ncc') continue;
        if (line.ton !== null && qty > line.ton + 1e-9) {
          setError(`${line.maHang || 'Dòng'}: số lượng ${qty} vượt tồn ${line.ton}.`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/xuat-nhap-tong-hop/${editingId}` : '/api/xuat-nhap-tong-hop', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không lưu được phiếu.');
        return;
      }
      const saved = data.record as TongHopHeader | null | undefined;
      const code = String(saved?.ma_phieu_chung || editingCode || '').trim();
      if (editingId) {
        if (saved?.id) setEditingId(saved.id);
        if (code) setEditingCode(code);
        setInfo(`Đã cập nhật phiếu ${code || 'này'}.`);
      } else {
        setInfo(code ? `Đã ghi phiếu ${code}.` : 'Đã ghi phiếu.');
        resetLines();
      }
    } finally {
      setSaving(false);
    }
  }

  function loadRecord(row: TongHopHeader) {
    setMode(row.loai);
    setEditingId(row.id);
    setEditingCode(row.ma_phieu_chung || '');
    setNgay(String(row.ngay || '').slice(0, 10));
    setCas(parseWarehouseShiftSelection(row.ca || ''));
    setNguonLoai(row.loai === 'nhap' && row.nguon_loai === 'ncc' ? 'ncc' : 'kho');
    setNguonId(row.loai === 'nhap' ? row.nguon_id || '' : '');
    setDichLoai(row.loai === 'xuat' && row.nguon_loai === 'may' ? 'may' : 'kho');
    setDichId(row.loai === 'xuat' ? row.nguon_id || '' : '');
    setLoaiNhap(row.loai_nhap || '');
    setLoaiXuat(row.loai_xuat || '');
    setNguoiLap(row.nguoi_lap || '');
    setNguoiGiao(row.nguoi_giao || '');
    setDiaDiem(row.dia_diem || '');
    setLyDo(row.ly_do || '');
    setGhiChu(row.ghi_chu || '');
    const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
    setLines(
      detail.length
        ? detail.map(item => ({
            ...emptyLine(),
            sourceLoai: row.loai === 'xuat' && item.nguon_dong_loai === 'may' ? 'may' : 'kho',
            khoId: row.loai === 'xuat' && item.nguon_dong_loai === 'may'
              ? String(item.nguon_dong_id || '')
              : String(item.kho_dong_id || item.kho_dong_ten || item.nguon_dong_id || ''),
            maHang: String(item.ma_hang || ''),
            tenHang: String(item.ten_hang || ''),
            donVi: String(item.don_vi || ''),
            soLuong: String(item.so_luong ?? ''),
            donGia: String(item.don_gia ?? '')
          }))
        : [emptyLine()]
    );
  }

  const openedEdit = useRef(false);
  useEffect(() => {
    if (openedEdit.current) return;
    openedEdit.current = true;
    const row = takePendingTongHopEdit();
    if (row) loadRecord(row);
  }, []);

  const nhapKho = warehouses.find(item => item.id === nguonId) || null;

  function lineKind(line: Line): 'nvl' | 'san_pham' {
    if (mode === 'nhap') return nguonLoai === 'ncc' || nhapKho?.vatTu ? 'nvl' : 'san_pham';
    if (dichLoai === 'may' || dest?.vatTu) return 'nvl';
    return 'san_pham';
  }

  function lineWeight(line: Line) {
    const qty = Number(String(line.soLuong).replace(',', '.'));
    return convertWarehouseQuantityToKg({
      quantity: qty,
      unit: line.donVi,
      itemCode: line.maHang,
      warehouseKind: lineKind(line),
      materials,
      products
    });
  }

  function lineAmount(line: Line) {
    const qty = Number(String(line.soLuong).replace(',', '.'));
    const price = Number(String(line.donGia).replace(',', '.'));
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return Math.round(qty * price * 1000) / 1000;
  }

  function toPrintLines(group: Line[]): WarehouseSlipPrintData['lines'] {
    return group.map(line => ({
      code: line.maHang,
      name: line.tenHang,
      unit: line.donVi,
      quantity: Number(String(line.soLuong).replace(',', '.')) || 0,
      unitPrice: Number(String(line.donGia).replace(',', '.')) || 0,
      lineAmount: lineAmount(line) || 0,
      weightKg: lineWeight(line)
    }));
  }

  function previewDraft() {
    setError('');
    const usable = lines.filter(line => line.maHang.trim() && Number(String(line.soLuong).replace(',', '.')) > 0);
    if (!usable.length) {
      setError('Nhập ít nhất một dòng có mã và số lượng để xem trước.');
      return;
    }
    if (mode === 'nhap' && !nguonId) {
      setError('Chọn nguồn nhập trước khi xem trước.');
      return;
    }
    if (mode === 'xuat' && !dichId) {
      setError('Chọn nguồn xuất trước khi xem trước.');
      return;
    }
    if (usable.some(line => !line.khoId)) {
      setError(mode === 'nhap' ? 'Mỗi dòng cần chọn kho nhập.' : 'Mỗi dòng cần chọn nơi xuất đến.');
      return;
    }
    const date = formatTongHopDate(ngay);
    const reason = mode === 'nhap' ? loaiNhap : loaiXuat;
    const shift = mode === 'xuat' ? formatWarehouseShiftSelection(cas) : '';
    const slips: WarehouseSlipPrintData[] = [];
    const pushSlip = (slip: Omit<WarehouseSlipPrintData, 'slipDate' | 'reason' | 'note' | 'createdBy' | 'isTemporary' | 'useWarehouseNameInTitle' | 'shift'> & { shift?: string }) => {
      slips.push({
        ...slip,
        slipDate: date,
        reason: lyDo || reason,
        note: ghiChu,
        createdBy: nguoiLap,
        deliverer: nguoiGiao,
        warehouseLocation: diaDiem,
        shift: slip.shift ?? shift,
        useWarehouseNameInTitle: true,
        isTemporary: true
      });
    };
    if (mode === 'nhap') {
      const sourceName = nguonLoai === 'ncc' ? (suppliers.find(item => item.id === nguonId)?.label || nguonId) : nguonId;
      if (nguonLoai === 'kho') {
        pushSlip({
          slipCode: 'XEM-XH',
          slipType: 'xuat',
          warehouseKind: nhapKho?.vatTu ? 'nvl' : 'san_pham',
          totalAmount: usable.reduce((sum, line) => sum + (lineAmount(line) || 0), 0),
          warehouseName: nguonId,
          deliverer: sourceName,
          lines: toPrintLines(usable)
        });
      }
      const byDest = new Map<string, Line[]>();
      for (const line of usable) byDest.set(line.khoId, [...(byDest.get(line.khoId) || []), line]);
      for (const [kho, group] of byDest) {
        const khoOpt = warehouses.find(item => item.id === kho);
        pushSlip({
          slipCode: 'XEM-NH',
          slipType: 'nhap',
          warehouseKind: khoOpt?.vatTu ? 'nvl' : 'san_pham',
          totalAmount: group.reduce((sum, line) => sum + (lineAmount(line) || 0), 0),
          warehouseName: kho,
          deliverer: sourceName,
          lines: toPrintLines(group)
        });
      }
    } else {
      const sourceLabel = dichLoai === 'may' ? (machines.find(item => item.id === dichId)?.label || dichId) : dichId;
      const sourceKind = dichLoai === 'may' || dest?.vatTu ? 'nvl' as const : 'san_pham' as const;
      const byDest = new Map<string, Line[]>();
      for (const line of usable) byDest.set(`${line.sourceLoai}|${line.khoId}`, [...(byDest.get(`${line.sourceLoai}|${line.khoId}`) || []), line]);
      for (const [key, group] of byDest) {
        const [destKind, destId] = key.split('|');
        const destLabel = destKind === 'may' ? (machines.find(item => item.id === destId)?.label || destId) : destId;
        const destKho = warehouses.find(item => item.id === destId);
        pushSlip({
          slipCode: 'XEM-XH',
          slipType: 'xuat',
          warehouseKind: sourceKind,
          totalAmount: group.reduce((sum, line) => sum + (lineAmount(line) || 0), 0),
          warehouseName: dichLoai === 'may' ? destLabel : sourceLabel,
          machine: destKind === 'may' ? destId : dichLoai === 'may' ? dichId : '',
          lines: toPrintLines(group)
        });
        if (destKind === 'kho') {
          pushSlip({
            slipCode: 'XEM-NH',
            slipType: 'nhap',
            warehouseKind: destKho?.vatTu ? 'nvl' : 'san_pham',
            totalAmount: group.reduce((sum, line) => sum + (lineAmount(line) || 0), 0),
            warehouseName: destId,
            deliverer: sourceLabel,
            lines: toPrintLines(group)
          });
        }
      }
    }
    setPrintSlips(slips);
  }
  const shiftOptions = getProductionShiftOptions(shiftSettings).map(item => item.value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">← Kho</button>
        <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">Phiếu nhập xuất tổng hợp</h1>
        <button type="button" onClick={onOpenList} className="text-xs font-extrabold text-[#ef1b2d]">Danh sách</button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-700">Loại phiếu</p>
        <div className="grid grid-cols-2 gap-2">
          {(['nhap', 'xuat'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                resetLines();
              }}
              className={`flex h-9 items-center justify-center rounded-lg border px-2 text-xs font-extrabold transition ${
                mode === tab
                  ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {tab === 'nhap' ? 'Phiếu nhập' : 'Phiếu xuất'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-2">
          <p className="text-sm font-black text-zinc-950">Thông tin phiếu</p>
          <p className="text-xs font-semibold text-zinc-400">{mode === 'nhap' ? 'Nhập kho' : 'Xuất kho'}</p>
          <p className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${editingId ? 'bg-amber-50 text-amber-800' : 'bg-zinc-100 text-zinc-600'}`}>
            {editingId ? `Đang sửa phiếu ${editingCode || editingId}` : 'Đang thêm phiếu mới'}
          </p>
          {editingId ? (
            <button type="button" onClick={resetLines} className="ml-auto text-[11px] font-extrabold text-[#ef1b2d]">Thêm phiếu mới</button>
          ) : null}
        </div>
        <div className="grid gap-x-2 gap-y-1.5 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày phiếu</span>
            <VnCalendarPicker value={ngay} onChange={setNgay} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">{mode === 'nhap' ? 'Loại nhập' : 'Loại xuất'}</span>
            <input
              value={mode === 'nhap' ? loaiNhap : loaiXuat}
              onChange={event => (mode === 'nhap' ? setLoaiNhap(event.target.value) : setLoaiXuat(event.target.value))}
              placeholder="Tự điền"
              className={fieldClass}
            />
          </label>
          {mode === 'xuat' ? <div className="block space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Ca <span className="font-semibold normal-case tracking-normal text-zinc-400">(không bắt buộc, chọn nhiều ca cùng loại ca)</span>
            </span>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
              {shiftOptions.length === 0 ? (
                <p className="text-xs font-semibold text-zinc-400">Chưa có ca trong cài đặt.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {shiftOptions.map(option => {
                    const checked = cas.includes(option);
                    return (
                      <label
                        key={option}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                          checked ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setCas(current => toggleWarehouseShiftSelection(current, option))}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-[11px] font-semibold text-zinc-500">
                {cas.length ? `Đã chọn: ${formatWarehouseShiftSelection(cas)}` : 'Có thể bỏ trống ca.'}
              </p>
            </div>
          </div> : null}
          {mode === 'nhap' ? (
            <div className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nguồn nhập</span>
              <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
                <select
                  value={nguonLoai}
                  onChange={event => {
                    setNguonLoai(event.target.value === 'ncc' ? 'ncc' : 'kho');
                    setNguonId('');
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', donVi: '', ton: null })));
                  }}
                  className={fieldClass}
                >
                  <option value="kho">Kho</option>
                  <option value="ncc">Nhà cung cấp</option>
                </select>
                <SearchableSelect
                  value={nguonId}
                  onChange={value => {
                    setNguonId(value);
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', donVi: '', ton: null })));
                  }}
                  options={(nguonLoai === 'ncc' ? suppliers : warehouses) as Option[]}
                  getValue={(item: Option) => item.id}
                  getLabel={(item: Option) => item.label}
                  placeholder={nguonLoai === 'ncc' ? 'Chọn nhà cung cấp' : 'Chọn kho lấy hàng'}
                  inputClassName={fieldClass}
                  comboboxMode
                  comboboxSearchable
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nguồn xuất</span>
              <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
                <select
                  value={dichLoai}
                  onChange={event => {
                    setDichLoai(event.target.value === 'may' ? 'may' : 'kho');
                    setDichId('');
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', donVi: '', ton: null })));
                  }}
                  className={fieldClass}
                >
                  <option value="kho">Kho</option>
                  <option value="may">Máy</option>
                </select>
                <SearchableSelect
                  value={dichId}
                  onChange={value => {
                    setDichId(value);
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', donVi: '', ton: null })));
                  }}
                  options={(dichLoai === 'may' ? machines : warehouses) as Option[]}
                  getValue={(item: Option) => item.id}
                  getLabel={(item: Option) => item.label}
                  placeholder={dichLoai === 'may' ? 'Chọn máy nguồn' : 'Chọn kho nguồn'}
                  inputClassName={fieldClass}
                  comboboxMode
                  comboboxSearchable
                />
              </div>
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người lập</span>
            <SearchableSelect
              value={nguoiLap}
              onChange={setNguoiLap}
              options={staff}
              getValue={(item: { id: string }) => item.id}
              getLabel={(item: { label: string }) => item.label}
              placeholder="Chọn người lập"
              inputClassName={fieldClass}
              comboboxMode
              comboboxSearchable
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người giao hàng</span>
            <input value={nguoiGiao} onChange={event => setNguoiGiao(event.target.value)} className={fieldClass} placeholder="Họ tên người giao hàng" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Địa điểm</span>
            <input value={diaDiem} onChange={event => setDiaDiem(event.target.value)} className={fieldClass} placeholder="VD: Phú Thọ" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lý do</span>
            <input value={lyDo} onChange={event => setLyDo(event.target.value)} className={fieldClass} placeholder={mode === 'nhap' ? 'VD: Nhập mua ngoài...' : 'VD: Xuất sản xuất...'} />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
            <input value={ghiChu} onChange={event => setGhiChu(event.target.value)} className={fieldClass} placeholder="Số chứng từ gốc kèm theo..." />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-max min-w-full text-xs">
            <thead>
              <tr className="bg-[#ef1b2d] text-left text-white">
                {mode === 'xuat' ? <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Loại</th> : null}
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">{mode === 'nhap' ? 'Kho nhập' : 'Xuất đến'}</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Mã</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tên</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tồn</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">SL</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Quy đổi kg</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Giá</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Thành tiền</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const sourceKho = line.sourceLoai === 'kho' ? warehouses.find(item => item.id === line.khoId) || null : null;
                const catalogKho = mode === 'nhap'
                  ? (nguonLoai === 'ncc' ? ({ id: '', label: '', kind: 'kho' as const, vatTu: true }) : nhapKho)
                  : dichLoai === 'may'
                    ? ({ id: dichId, label: '', kind: 'may' as const, vatTu: true })
                    : (warehouses.find(item => item.id === dichId) || null);
                const options = itemsFor(catalogKho);
                const sourceOptions = line.sourceLoai === 'ncc' ? suppliers : line.sourceLoai === 'may' ? machines : warehouses;
                return (
                  <tr key={line.key} className="border-b border-zinc-100">
                    {mode === 'xuat' ? (
                      <td className="px-2 py-2 align-middle">
                        <select
                          value={line.sourceLoai === 'may' ? 'may' : 'kho'}
                          onChange={event => patchLine(index, { sourceLoai: event.target.value === 'may' ? 'may' : 'kho', khoId: '' })}
                          className={`${fieldClass} w-36`}
                        >
                          <option value="kho">Kho</option>
                          <option value="may">Máy</option>
                        </select>
                      </td>
                    ) : null}
                    <td className="px-2 py-2 align-middle">
                      <div className="w-56">
                        <SearchableSelect
                          value={line.khoId}
                          onChange={value => {
                            const next = { ...line, khoId: value };
                            patchLine(index, next);
                            if (mode !== 'nhap') void refreshTon(index, next);
                          }}
                          options={mode === 'nhap' ? warehouses : sourceOptions}
                          getValue={(item: Option) => item.id}
                          getLabel={(item: Option) => item.label}
                          placeholder={mode === 'nhap' ? 'Chọn kho nhập' : line.sourceLoai === 'may' ? 'Chọn máy đến' : 'Chọn kho đến'}
                          inputClassName={fieldClass}
                          comboboxMode
                          comboboxSearchable
                          openUpward
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-56 shrink-0">
                          <SearchableSelect
                            value={line.maHang}
                            onChange={value => {
                              const found = options.find(item => item.id === value);
                              const next = { ...line, maHang: value, tenHang: found?.name || '', donVi: found?.unit || '' };
                              patchLine(index, next);
                              void refreshTon(index, next);
                            }}
                            options={options}
                            getValue={(item: { id: string }) => item.id}
                            getLabel={(item: { label: string }) => item.label}
                            placeholder="Mã hàng"
                            inputClassName={fieldClass}
                            comboboxMode
                            comboboxSearchable
                            openUpward
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle">{line.tenHang || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle tabular-nums">{line.ton === null ? '—' : line.ton}</td>
                    <td className="px-2 py-2 align-middle"><input value={line.soLuong} onChange={event => patchLine(index, { soLuong: event.target.value })} className={`${fieldClass} w-24`} /></td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle font-mono font-bold text-emerald-800">{formatWarehouseWeightKg(lineWeight(line))}</td>
                    <td className="px-2 py-2 align-middle"><input value={line.donGia} onChange={event => patchLine(index, { donGia: event.target.value })} className={`${fieldClass} w-28`} /></td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle text-right font-mono font-bold tabular-nums">{lineAmount(line) === null ? '—' : lineAmount(line)}</td>
                    <td className="px-2 py-2 align-middle">
                      <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setLines(current => [...current, emptyLine()])} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#ef1b2d]">
          <Plus className="h-4 w-4" /> Thêm dòng
        </button>
        {mode === 'nhap' ? (
          <p className="text-[11px] font-semibold text-zinc-500">Nguồn nhập là chỗ lấy hàng và lọc mã bên dưới. Nhà cung cấp lấy mã từ kho NVL. Cột Kho nhập là kho nhận hàng.</p>
        ) : (
          <p className="text-[11px] font-semibold text-zinc-500">Nguồn xuất là chỗ lấy hàng và lọc mã bên dưới. Cột Xuất đến là kho hoặc máy nhận hàng.</p>
        )}
        {warning ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}
          </p>
        ) : null}
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
        {info ? <p className="text-sm font-semibold text-emerald-700">{info}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={previewDraft} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#ef1b2d] px-4 text-xs font-extrabold text-[#ef1b2d]">
            <Printer className="h-4 w-4" /> Xem trước
          </button>
          <button type="button" disabled={saving} onClick={() => void onSave()} className="h-9 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white disabled:opacity-60">
            {saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Lưu phiếu'}
          </button>
        </div>
      </section>

      <WarehouseSlipPrintModal open={Boolean(printSlips)} slips={printSlips} onClose={() => setPrintSlips(null)} />
    </div>
  );
}

export { TongHopListPanel } from './list';
