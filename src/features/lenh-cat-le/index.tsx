import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';
import {
  KHO_CAT_LE,
  KHO_TAI_CHE,
  KHO_THANH_PHAM,
  buildCatLePrintSlips,
  buildCatLeSanPhamLine,
  computeCatLe,
  normalizeCatLeSanPhamList,
  motherFromNhapKhoRow,
  parseMeterInput,
  parseMeterLabel,
  type CatLeMother,
  type CatLePrintSlip,
  type CatLeSanPhamLine
} from './logic';

export interface CatLeLenh {
  id: string;
  ma_lenh: string;
  ngay_cat: string;
  trang_thai: string;
  kho_nguon?: string | null;
  kho_dich?: string | null;
  kho_tai_che?: string | null;
  san_pham?: CatLeSanPhamLine[] | null;
  ma_phieu_xuat: string | null;
  ma_phieu_nhap_tp: string | null;
  ma_phieu_nhap_thua: string | null;
  ma_phieu_chuyen_tai_che?: string | null;
  ma_phieu_xuat_tai_che?: string | null;
  ma_phieu_nhap_tai_che?: string | null;
  nguoi_thuc_hien: string | null;
  nguoi_lap: string | null;
  ghi_chu: string | null;
  created_at?: string;
}

interface MotherStockRow {
  key: string;
  id: string;
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  ton_sl: number;
  ton_kg: number;
  kg1: number;
  a1: number;
  l1: number;
  raw: Record<string, unknown>;
}

interface CutLine {
  key: string;
  motherKey: string;
  /** Độ li (độ dày) SP đích. Trống = giữ mẹ. */
  doLiText: string;
  /** Khổ cuộn rộng (m). Trống = giữ mẹ. */
  khoRongText: string;
  /** M dài cần cắt. Trống = giữ mẹ. */
  mDaiText: string;
  qtyText: string;
  kgCanText: string;
  ghiChu: string;
}

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const cellInputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[13px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

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

/** Quy đổi 1 SP: kg, m², m dài — đúng bộ số ghi vào nhap_kho. */
function fmtQuyDoi(piece: { kg: number; m2: number; m_dai: number }): string {
  return `1 SP: ${fmtQty(piece.kg)} kg · ${fmtQty(piece.m2)} m² · ${fmtQty(piece.m_dai)} m`;
}

function toPrintData(slip: CatLePrintSlip, temporary = false): WarehouseSlipPrintData {
  return {
    slipCode: slip.slipCode,
    slipType: slip.slipType,
    warehouseKind: 'san_pham',
    slipDate: slip.slipDate,
    reason: slip.reason,
    note: slip.note,
    createdBy: slip.createdBy,
    totalAmount: 0,
    warehouseName: slip.warehouseName,
    isTemporary: temporary,
    lines: slip.lines.map(line => ({
      code: line.code,
      name: line.name,
      unit: line.unit,
      quantity: line.quantity,
      unitPrice: 0,
      lineAmount: 0,
      weightKg: line.weightKg
    }))
  };
}

function trangThaiLabel(value: string): string {
  if (value === 'hoan_thanh') return 'Đã duyệt';
  if (value === 'huy') return 'Đã hủy';
  return 'Chờ duyệt';
}

function cutLineFromSaved(item: CatLeSanPhamLine, stock: MotherStockRow[]): CutLine {
  const nguon = item.san_pham_nguon;
  const cat1 = item.san_pham_cat_1;
  const match =
    stock.find(row => row.ma_sp === nguon.ma_sp && row.ten_sp === nguon.ten_sp) ||
    stock.find(row => row.id && row.id === nguon.id_san_pham_trong_kho);
  const w = parseMeterLabel(cat1.do_day_m);
  const l = parseMeterLabel(cat1.do_dai_m) || (cat1.m_dai > 0 ? cat1.m_dai : null);
  const doLiChanged = Boolean(cat1.do_li) && cat1.do_li !== nguon.do_li;
  const base = newCutLine();
  return {
    ...base,
    motherKey: match?.key || '',
    doLiText: doLiChanged ? cat1.do_li.replace(/\s*li\s*$/iu, '') : '',
    khoRongText: w ? String(w) : '',
    mDaiText: l ? String(l) : '',
    qtyText: String(nguon.so_luong || 1),
    kgCanText: '',
    ghiChu: item.ghi_chu || ''
  };
}

let lineSeq = 0;
const newCutLine = (): CutLine => {
  lineSeq += 1;
  return {
    key: `line-${Date.now()}-${lineSeq}`,
    motherKey: '',
    doLiText: '',
    khoRongText: '',
    mDaiText: '',
    qtyText: '1',
    kgCanText: '',
    ghiChu: ''
  };
};

function buildMother(row: MotherStockRow): CatLeMother | null {
  return (
    motherFromNhapKhoRow(
      {
        ma_sp: row.ma_sp,
        ten_sp: row.ten_sp,
        don_vi: row.don_vi,
        trong_luong_kg_mot_sp: row.kg1,
        so_m2_mot_sp: row.a1,
        so_m_dai_mot_sp: row.l1,
        ...(row.raw as object)
      },
      undefined
    ) || null
  );
}

/** Khổ rộng mẹ (m): ưu tiên a1/l1, fallback specs do_day_m. */
function motherWidth(mother: CatLeMother): number | null {
  if (mother.a1 > 0 && mother.l1 > 0) return mother.a1 / mother.l1;
  return parseMeterLabel(mother.doDayM);
}

export function LenCatLePanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('lenh-cat-le');
  const [stock, setStock] = useState<MotherStockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [lenhList, setLenhList] = useState<CatLeLenh[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [completingId, setCompletingId] = useState('');
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  // Modal lập lệnh
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmedLines, setConfirmedLines] = useState<CatLeSanPhamLine[] | null>(null);
  const [modalError, setModalError] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [timSp, setTimSp] = useState('');
  const [ngayCat, setNgayCat] = useState(todayISO());
  const [nguoiThucHien, setNguoiThucHien] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [lines, setLines] = useState<CutLine[]>([newCutLine()]);

  const loadStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams({ from: '2020-01-01', to: todayISO(), tenKho: KHO_CAT_LE, strictKho: '1' });
      const res = await fetch(`/api/nhap-kho?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được tồn kho cắt lẻ.'));
      const rows: unknown[] = Array.isArray((data as { rows?: unknown }).rows)
        ? (data as { rows: unknown[] }).rows
        : [];
      const mapped: MotherStockRow[] = [];
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
        mapped.push({
          key: `${ma}||${ten}||${kg1}|${a1}|${l1}`,
          id: String(row.id ?? '').trim(),
          ma_sp: ma,
          ten_sp: ten,
          don_vi: String(row.don_vi ?? '').trim(),
          nhom_vthh: String(row.nhom_vthh ?? '').trim(),
          ton_sl: tonSl,
          ton_kg: toNum(ton.kg),
          kg1,
          a1,
          l1,
          raw: row
        });
      }
      mapped.sort((a, b) => `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi'));
      setStock(mapped);
    } catch (err: any) {
      setStock([]);
      showAppToast(err?.message || 'Không tải được tồn kho cắt lẻ.', 'error');
    } finally {
      setStockLoading(false);
    }
  }, []);

  const loadLenh = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/lenh-cat-le');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được lệnh cắt.'));
      const records = Array.isArray((data as { records?: unknown }).records)
        ? ((data as { records: unknown[] }).records as CatLeLenh[])
        : [];
      setLenhList(records);
    } catch (err: any) {
      setLenhList([]);
      showAppToast(err?.message || 'Không tải được lệnh cắt.', 'error');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStock();
    void loadLenh();
  }, [loadStock, loadLenh]);

  const openModal = () => {
    setEditingId(null);
    setNgayCat(todayISO());
    setNguoiThucHien('');
    setNguoiLap('');
    setLines([newCutLine()]);
    setConfirmedLines(null);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (row: CatLeLenh) => {
    if (row.trang_thai !== 'moi') return;
    const products = normalizeCatLeSanPhamList(row.san_pham);
    setEditingId(row.id);
    setNgayCat(String(row.ngay_cat || '').slice(0, 10) || todayISO());
    setNguoiThucHien(row.nguoi_thuc_hien || '');
    setNguoiLap(row.nguoi_lap || '');
    setLines(products.length > 0 ? products.map(item => cutLineFromSaved(item, stock)) : [newCutLine()]);
    setConfirmedLines(null);
    setModalError(
      products.some(item => {
        const match = stock.some(
          s =>
            (s.ma_sp === item.san_pham_nguon.ma_sp && s.ten_sp === item.san_pham_nguon.ten_sp) ||
            (s.id && s.id === item.san_pham_nguon.id_san_pham_trong_kho)
        );
        return !match;
      })
        ? 'Một số sản phẩm nguồn không còn tồn — hãy chọn lại trước khi lưu.'
        : ''
    );
    setShowModal(true);
  };

  const updateLine = (key: string, patch: Partial<CutLine>) => {
    setConfirmedLines(null);
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setConfirmedLines(null);
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(line => line.key !== key)));
  };

  interface LinePreview {
    motherRow: MotherStockRow | null;
    mother: CatLeMother | null;
    w2: number | null;
    l2: number | null;
    qty: number;
    result: ReturnType<typeof computeCatLe> | null;
    error: string;
  }

  const previews: LinePreview[] = useMemo(() => {
    const used = new Map<string, number>();
    return lines.map(line => {
        const empty: LinePreview = { motherRow: null, mother: null, w2: null, l2: null, qty: 0, result: null, error: '' };
        const motherRow = stock.find(row => row.key === line.motherKey) || null;
        if (!motherRow) return { ...empty, error: line.motherKey ? 'Cuộn mẹ đã hết tồn.' : '' };
        const mother = buildMother(motherRow);
        if (!mother) return { ...empty, motherRow, error: 'Không đọc được thông số mẹ.' };
        const w1 = motherWidth(mother);
        const l1 = mother.l1 > 0 ? mother.l1 : parseMeterLabel(mother.doDaiM);
        const w2 = w1;
        const l2 = parseMeterInput(line.mDaiText) ?? l1;
        const qty = Number(String(line.qtyText || '').replace(',', '.'));
        const base = { ...empty, motherRow, mother, w2, l2, qty };
        if (!w2 || !l2) return { ...base, error: 'Nhập độ li hoặc m dài cần cắt.' };
        if (!(qty > 0)) return { ...base, error: 'Nhập số lượng cắt.' };
        const taken = used.get(line.motherKey) || 0;
        if (qty + taken > motherRow.ton_sl + 1e-9) {
          return { ...base, error: `Tồn mẹ chỉ còn ${motherRow.ton_sl}${taken > 0 ? ` (đã chọn ${taken} ở dòng khác)` : ''}.` };
        }
        try {
          const result = computeCatLe(
            mother,
            {
              w2,
              l2,
              qty,
              doLiMoi: line.doLiText.trim() || null,
              kgCanThucTe: null
            },
            { nhomVthh: motherRow.nhom_vthh }
          );
          used.set(line.motherKey, taken + qty);
          return { ...base, result };
        } catch (err: any) {
          return { ...base, error: err?.message || 'Thông số cắt không hợp lệ.' };
        }
    });
  }, [lines, stock]);

  const totals = useMemo(() => {
    let qty = 0;
    previews.forEach((preview, index) => {
      if (!preview.result) return;
      qty += Number(String(lines[index]?.qtyText || '').replace(',', '.')) || 0;
    });
    return { qty };
  }, [previews, lines]);

  const canSave =
    lines.length > 0 &&
    lines.every((_, index) => {
      const preview = previews[index];
      return preview && preview.motherRow && preview.result && !preview.error;
    });

  const filteredLenh = useMemo(() => {
    const q = timSp.trim().toLocaleLowerCase('vi');
    return lenhList.filter(row => {
      const day = String(row.ngay_cat || '').slice(0, 10);
      if (!day) {
        if (tuNgay || denNgay) return false;
      } else {
        if (tuNgay && day < tuNgay) return false;
        if (denNgay && day > denNgay) return false;
      }
      if (q) {
        const products = normalizeCatLeSanPhamList(row.san_pham);
        const hay = [
          row.ma_lenh,
          row.nguoi_thuc_hien,
          row.nguoi_lap,
          row.ghi_chu,
          row.ma_phieu_xuat,
          row.ma_phieu_nhap_tp,
          row.ma_phieu_nhap_thua,
          row.ma_phieu_chuyen_tai_che,
          ...products.flatMap(item => [
            item.san_pham_nguon?.ma_sp,
            item.san_pham_nguon?.ten_sp,
            item.san_pham_cat_1?.ten_sp,
            item.san_pham_cat_2?.ten_sp
          ])
        ]
          .map(v => String(v ?? '').toLocaleLowerCase('vi'))
          .join(' | ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lenhList, tuNgay, denNgay, timSp]);

  const openPrint = (row: CatLeLenh) => {
    const slips = buildCatLePrintSlips(row).map(slip => toPrintData(slip));
    if (slips.length === 0) {
      showAppToast('Lệnh chưa ghi kho — chưa có phiếu để in.', 'error');
      return;
    }
    setPrintSlips(slips);
  };

  const showSlipPreview = (lenh: Parameters<typeof buildCatLePrintSlips>[0]) => {
    const slips = buildCatLePrintSlips(lenh, { preview: true }).map(slip => toPrintData(slip, true));
    if (slips.length === 0) {
      showAppToast('Chưa có sản phẩm để xem trước phiếu nhập / xuất.', 'error');
      return;
    }
    setPrintSlips(slips);
  };

  const linesFromForm = (): CatLeSanPhamLine[] =>
    lines.map((line, index) => {
      const preview = previews[index];
      const mother = preview.mother as CatLeMother;
      const row = preview.motherRow as MotherStockRow;
      return buildCatLeSanPhamLine({
        idSanPhamTrongKho: row.id,
        mother,
        nhomVthh: row.nhom_vthh,
        qty: preview.qty,
        w2: preview.w2 as number,
        l2: preview.l2 as number,
        doLiMoi: line.doLiText.trim() || null,
        kgCanThucTe: null,
        ghiChu: line.ghiChu.trim()
      });
    });

  const handleConfirmPreview = () => {
    if (!canSave) {
      setModalError('Còn dòng chưa hợp lệ — kiểm tra sản phẩm nguồn, độ li, m dài và số lượng.');
      setConfirmedLines(null);
      return;
    }
    try {
      const built = linesFromForm();
      setConfirmedLines(built);
      setModalError('');
    } catch (err: any) {
      setConfirmedLines(null);
      setModalError(err?.message || 'Không xem được kết quả cắt.');
    }
  };

  const handleSaveModal = async () => {
    if (!canSave) {
      setModalError('Còn dòng chưa hợp lệ — kiểm tra sản phẩm nguồn, độ li, m dài và số lượng.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const sanPham = lines.map((line, index) => {
        const preview = previews[index];
        const mother = preview.mother as CatLeMother;
        const row = preview.motherRow as MotherStockRow;
        return {
          idSanPhamTrongKho: row.id,
          maSpNguon: mother.maSp,
          tenSpNguon: mother.tenSp,
          donVi: mother.donVi,
          soLuong: preview.qty,
          kgNguon: mother.kg1,
          m2Nguon: mother.a1,
          mDaiNguon: mother.l1,
          tenGoc: mother.tenGoc,
          doLi: mother.doLi,
          doLiDm: mother.doLiDm,
          doDayM: mother.doDayM,
          doDaiM: mother.doDaiM,
          mang: mother.mang,
          hangPhe: mother.hangPhe,
          maAmis: mother.maAmis,
          nhomVthh: row.nhom_vthh,
          doLiCat: line.doLiText.trim(),
          mDaiCat: preview.l2,
          khoRongM: preview.w2,
          kgCanThucTe: null,
          ghiChu: line.ghiChu.trim()
        };
      });
      const payload = {
        ngayCat,
        khoNguon: KHO_CAT_LE,
        khoDich: KHO_THANH_PHAM,
        nguoiThucHien: nguoiThucHien.trim(),
        nguoiLap: nguoiLap.trim(),
        sanPham
      };
      const res = await fetch(editingId ? `/api/lenh-cat-le/${encodeURIComponent(editingId)}` : '/api/lenh-cat-le', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, editingId ? 'Không sửa được lệnh cắt.' : 'Không tạo được lệnh cắt.'));
      showAppToast(editingId ? 'Đã lưu sửa. Bấm Duyệt để ghi kho.' : 'Đã lưu lệnh chờ duyệt. Bấm Duyệt để ghi kho.', 'success');
      setShowModal(false);
    } catch (err: any) {
      setModalError(err?.message || 'Không lưu được lệnh cắt.');
    } finally {
      setSaving(false);
      void loadLenh();
    }
  };

  const handleComplete = async (id: string) => {
    if (
      !window.confirm(
        `Duyệt lệnh này? Hệ thống xuất ${KHO_CAT_LE} sản phẩm đang có tồn, nhập ${KHO_THANH_PHAM}. Phần còn lại từ 2m nhập lại ${KHO_CAT_LE}. Dưới 2m nhập thẳng ${KHO_TAI_CHE}, không xuất. Sau khi duyệt không sửa được.`
      )
    ) {
      return;
    }
    setCompletingId(id);
    try {
      const res = await fetch(`/api/lenh-cat-le/${encodeURIComponent(id)}/hoan-thanh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không duyệt được lệnh cắt.'));
      const record = (data as { record?: CatLeLenh }).record;
      showAppToast(
        (data as { di_tai_che?: boolean }).di_tai_che
          ? 'Đã duyệt — phần dưới 2m nhập thẳng Kho tái chế, không xuất.'
          : 'Đã duyệt và ghi phiếu xuất / nhập.',
        'success'
      );
      if (record) openPrint(record);
      void loadLenh();
      void loadStock();
    } catch (err: any) {
      showAppToast(err?.message || 'Không duyệt được lệnh cắt.', 'error');
    } finally {
      setCompletingId('');
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Hủy lệnh cắt này?')) return;
    try {
      const res = await fetch(`/api/lenh-cat-le/${encodeURIComponent(id)}/huy`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không hủy được lệnh cắt.'));
      showAppToast('Đã hủy lệnh cắt.', 'success');
      void loadLenh();
    } catch (err: any) {
      showAppToast(err?.message || 'Không hủy được lệnh cắt.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa lệnh cắt này?')) return;
    try {
      const res = await fetch(`/api/lenh-cat-le/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không xóa được lệnh cắt.'));
      showAppToast('Đã xóa lệnh cắt.', 'success');
      void loadLenh();
    } catch (err: any) {
      showAppToast(err?.message || 'Không xóa được lệnh cắt.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Lệnh cắt lẻ</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Một lệnh nhiều sản phẩm. Lưu và sửa không ghi kho — bấm Duyệt mới xuất {KHO_CAT_LE} sản phẩm đang có tồn, nhập {KHO_THANH_PHAM}. Phần còn lại từ 2m nhập lại {KHO_CAT_LE}. Dưới 2m nhập thẳng {KHO_TAI_CHE}, không xuất. Sau khi duyệt không sửa được.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canCreate && (
            <button
              onClick={openModal}
              className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-4 py-2 text-sm font-black text-white"
            >
              <Plus size={16} /> Tạo mới
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <VnCalendarPicker value={tuNgay} onChange={setTuNgay} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <VnCalendarPicker value={denNgay} onChange={setDenNgay} />
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
            onClick={() => {
              void loadStock();
              void loadLenh();
            }}
            className="rounded-lg bg-[#ef1b2d] px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-[#d41424]"
          >
            Tải lại
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <div className="text-xs font-black uppercase text-zinc-600">
            Danh sách lệnh cắt {listLoading ? '(đang tải...)' : `(${filteredLenh.length})`}
          </div>
          {(tuNgay || denNgay || timSp.trim()) && (
            <button
              type="button"
              onClick={() => {
                setTuNgay('');
                setDenNgay('');
                setTimSp('');
              }}
              className="ml-auto rounded-lg border px-3 py-2 text-xs font-bold text-zinc-600"
            >
              Xóa lọc
            </button>
          )}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Mã lệnh</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Sản phẩm nguồn</th>
                <th className="px-3 py-2">Sản phẩm cắt 1</th>
                <th className="px-3 py-2">Sản phẩm cắt 2</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2">Người TH</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Phiếu</th>
                <th className="px-3 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredLenh.map(row => {
                const products = normalizeCatLeSanPhamList(row.san_pham);
                const nguon = products
                  .map(item => item.san_pham_nguon.ten_sp || item.san_pham_nguon.ma_sp)
                  .filter(Boolean)
                  .join(' · ');
                const cat1 = products.map(item => item.san_pham_cat_1.ten_sp).filter(Boolean).join(' · ');
                const cat2 = products.map(item => item.san_pham_cat_2?.ten_sp || '').filter(Boolean).join(' · ');
                const soLuong = products.reduce((sum, item) => sum + (Number(item.san_pham_nguon.so_luong) || 0), 0);
                return (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-black">{row.ma_lenh}</td>
                  <td className="px-3 py-2 font-semibold">{formatDateVN(row.ngay_cat)}</td>
                  <td className="px-3 py-2 font-semibold">
                    {products.length > 1 ? `${products.length} SP — ` : ''}
                    {nguon}
                  </td>
                  <td className="px-3 py-2 font-semibold">{cat1 || '—'}</td>
                  <td className="px-3 py-2 font-semibold">
                    {cat2 || '—'}
                    {products.some(item => item.di_tai_che) && (
                      <span className="ml-1 font-black text-red-600">(nhập tái chế)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{soLuong}</td>
                  <td className="px-3 py-2 font-semibold">{row.nguoi_thuc_hien || '—'}</td>
                  <td className="px-3 py-2 font-bold">{trangThaiLabel(row.trang_thai)}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {[row.ma_phieu_xuat, row.ma_phieu_nhap_tp, row.ma_phieu_nhap_thua, row.ma_phieu_chuyen_tai_che]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {row.trang_thai === 'moi' && (
                        <button
                          title="Xem trước phiếu nhập / xuất — chưa ghi kho"
                          onClick={() =>
                            showSlipPreview({
                              ma_lenh: row.ma_lenh,
                              ngay_cat: row.ngay_cat,
                              kho_nguon: row.kho_nguon,
                              kho_dich: row.kho_dich,
                              kho_tai_che: row.kho_tai_che,
                              nguoi_lap: row.nguoi_lap,
                              san_pham: products
                            })
                          }
                          className="rounded border border-sky-300 px-2 py-1 text-[11px] font-black text-sky-800"
                        >
                          Xem trước
                        </button>
                      )}
                      {row.trang_thai === 'hoan_thanh' && (
                        <button
                          title="In phiếu nhập / xuất"
                          onClick={() => openPrint(row)}
                          className="rounded border p-2 text-zinc-600"
                        >
                          <Printer size={14} />
                        </button>
                      )}
                      {row.trang_thai === 'moi' && canEdit && (
                        <button
                          title="Sửa lệnh — chưa ghi kho"
                          onClick={() => openEdit(row)}
                          className="rounded border px-2 py-1 text-[11px] font-black text-zinc-700"
                        >
                          <Pencil size={14} className="inline" /> Sửa
                        </button>
                      )}
                      {row.trang_thai === 'moi' && canEdit && (
                        <button
                          title="Duyệt — ghi xuất/nhập kho"
                          onClick={() => void handleComplete(row.id)}
                          disabled={completingId === row.id}
                          className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-black text-emerald-700 disabled:opacity-50"
                        >
                          {completingId === row.id ? <Loader2 size={14} className="inline animate-spin" /> : 'Duyệt'}
                        </button>
                      )}
                      {row.trang_thai === 'moi' && canEdit && (
                        <button title="Hủy lệnh" onClick={() => void handleCancel(row.id)} className="rounded border p-2 text-amber-600">
                          <X size={14} />
                        </button>
                      )}
                      {row.trang_thai === 'moi' && canDelete && (
                        <button title="Xóa lệnh" onClick={() => void handleDelete(row.id)} className="rounded border p-2 text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredLenh.length === 0 && !listLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center font-bold text-zinc-400">
                    {tuNgay || denNgay || timSp.trim() ? 'Chưa có lệnh cắt trong khoảng lọc này.' : 'Chưa có lệnh cắt nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[94vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b bg-white px-4 py-3">
              <h3 className="text-sm font-black text-zinc-900">{editingId ? 'Sửa lệnh cắt lẻ' : 'Lập lệnh cắt lẻ'}</h3>
              <span className="text-xs font-semibold text-zinc-500">
                {KHO_CAT_LE} → {KHO_THANH_PHAM} (+ thừa / tái chế)
              </span>
              <button onClick={() => setShowModal(false)} className="ml-auto rounded border p-2 text-zinc-600">
                <X size={14} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              <section className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Ngày lệnh cắt</span>
                  <VnCalendarPicker value={ngayCat} onChange={setNgayCat} />
                  <p className="text-[11px] font-semibold text-zinc-600">{formatDateVN(ngayCat)}</p>
                </div>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Người thực hiện</span>
                  <input value={nguoiThucHien} onChange={e => setNguoiThucHien(e.target.value)} placeholder="Người trực tiếp cắt" className={inputClass} />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Người lập phiếu</span>
                  <input value={nguoiLap} onChange={e => setNguoiLap(e.target.value)} placeholder="Người lập lệnh" className={inputClass} />
                </label>
              </section>

              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-black uppercase text-zinc-700">Sản phẩm cần cắt</h4>
                  {canSave && (
                    <button
                      type="button"
                      onClick={handleConfirmPreview}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-black text-emerald-800"
                    >
                      <Check size={14} /> Xác nhận
                    </button>
                  )}
                  {canSave && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          showSlipPreview({
                            ngay_cat: ngayCat,
                            kho_nguon: KHO_CAT_LE,
                            kho_dich: KHO_THANH_PHAM,
                            kho_tai_che: KHO_TAI_CHE,
                            nguoi_lap: nguoiLap.trim(),
                            san_pham: linesFromForm()
                          });
                        } catch (err: any) {
                          setModalError(err?.message || 'Không xem trước được phiếu.');
                        }
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-black text-sky-800"
                    >
                      <Printer size={14} /> Xem trước phiếu
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setConfirmedLines(null);
                      setLines(prev => [...prev, newCutLine()]);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus size={14} /> Thêm dòng
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-zinc-900 text-[10px] uppercase text-white">
                      <tr>
                        <th className="px-2 py-2 text-center">STT</th>
                        <th className="px-2 py-2">Mã SP *</th>
                        <th className="px-2 py-2">Tên SP *</th>
                        <th className="px-2 py-2 text-center">ĐVT</th>
                        <th className="px-2 py-2 text-center">Tồn</th>
                        <th className="px-2 py-2 text-center">Độ li (độ dày)</th>
                        <th className="px-2 py-2 text-center">M dài cắt</th>
                        <th className="px-2 py-2 text-center">SL *</th>
                        <th className="px-2 py-2 text-center">Ghi chú</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => {
                        const preview = previews[index];
                        const confirmed = confirmedLines?.[index] || null;
                        const row = preview?.motherRow || null;
                        const tenOptions = row ? stock.filter(item => item.ma_sp === row.ma_sp) : stock;
                        return (
                          <React.Fragment key={line.key}>
                            <tr className="border-t align-top">
                              <td className="px-2 py-2 text-center font-black">{index + 1}</td>
                              <td className="min-w-[150px] px-2 py-2">
                                <SearchableSelect
                                  value={line.motherKey}
                                  onChange={value => updateLine(line.key, { motherKey: value })}
                                  options={stock}
                                  placeholder={stockLoading ? 'Đang tải...' : 'Mã SP...'}
                                  isLoading={stockLoading}
                                  getLabel={(item: unknown) => {
                                    const r = item as MotherStockRow;
                                    return `${r.ma_sp} — tồn ${r.ton_sl}`;
                                  }}
                                  getValue={(item: unknown) => (item as MotherStockRow).key}
                                />
                              </td>
                              <td className="min-w-[260px] px-2 py-2">
                                <SearchableSelect
                                  value={line.motherKey}
                                  onChange={value => updateLine(line.key, { motherKey: value })}
                                  options={tenOptions}
                                  placeholder={stockLoading ? 'Đang tải...' : 'Tên SP...'}
                                  isLoading={stockLoading}
                                  getLabel={(item: unknown) => {
                                    const r = item as MotherStockRow;
                                    return `${r.ten_sp} — tồn ${r.ton_sl}`;
                                  }}
                                  getValue={(item: unknown) => (item as MotherStockRow).key}
                                />
                              </td>
                              <td className="px-2 py-2 text-center font-bold">{row?.don_vi || '—'}</td>
                              <td className="px-2 py-2 text-center font-bold">{row ? row.ton_sl : '—'}</td>
                              <td className="px-2 py-2">
                                <input
                                  value={line.doLiText}
                                  onChange={e => updateLine(line.key, { doLiText: e.target.value })}
                                  inputMode="decimal"
                                  placeholder={preview?.mother?.doLi || 'giữ độ li'}
                                  title="Độ li (độ dày) SP đích — bỏ trống = giữ mẹ. Có số mới thì tên và do_day_m ghép lại (1 → 1m)."
                                  className={cellInputClass}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={line.mDaiText}
                                  onChange={e => updateLine(line.key, { mDaiText: e.target.value })}
                                  inputMode="decimal"
                                  placeholder={row ? `Mẹ ${fmtQty(row.l1)}` : 'vd 12'}
                                  title="M dài cần cắt — bỏ trống = giữ nguyên m dài mẹ. Khổ rộng giữ theo sản phẩm nguồn."
                                  className={cellInputClass}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  value={line.qtyText}
                                  onChange={e => updateLine(line.key, { qtyText: e.target.value })}
                                  inputMode="decimal"
                                  className={`${cellInputClass} text-right`}
                                />
                              </td>
                              <td className="min-w-[140px] px-2 py-2">
                                <input
                                  value={line.ghiChu}
                                  onChange={e => updateLine(line.key, { ghiChu: e.target.value })}
                                  placeholder="Ghi chú dòng này"
                                  className={cellInputClass}
                                />
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
                            {preview?.error ? (
                              <tr className="border-t bg-red-50/70">
                                <td />
                                <td colSpan={9} className="px-2 py-1.5 text-[11px] font-bold text-red-600">
                                  {preview.error}
                                </td>
                              </tr>
                            ) : null}
                            {confirmed?.san_pham_cat_1 ? (
                              <tr className="border-t bg-emerald-50/80">
                                <td />
                                <td colSpan={9} className="px-2 py-1.5 text-[12px] font-semibold text-zinc-800">
                                  <span className="font-black text-emerald-800">Cắt</span>
                                  {' · '}
                                  {KHO_THANH_PHAM}
                                  {' · '}
                                  <span className="font-mono font-bold">{confirmed.san_pham_nguon.ma_sp}</span>
                                  {' · '}
                                  {confirmed.san_pham_cat_1.ten_sp}
                                  {' · SL '}
                                  {fmtQty(confirmed.san_pham_nguon.so_luong)}
                                  {' · '}
                                  {fmtQuyDoi(confirmed.san_pham_cat_1)}
                                </td>
                              </tr>
                            ) : null}
                            {confirmed?.san_pham_cat_2 ? (
                              <tr className="border-t bg-amber-50/80">
                                <td />
                                <td colSpan={9} className="px-2 py-1.5 text-[12px] font-semibold text-zinc-800">
                                  <span className="font-black text-amber-800">Còn lại</span>
                                  {' · '}
                                  {confirmed.di_tai_che ? KHO_TAI_CHE : KHO_CAT_LE}
                                  {' · '}
                                  <span className="font-mono font-bold">{confirmed.san_pham_nguon.ma_sp}</span>
                                  {' · '}
                                  {confirmed.san_pham_cat_2.ten_sp}
                                  {' · SL '}
                                  {fmtQty(confirmed.san_pham_nguon.so_luong)}
                                  {' · '}
                                  {fmtQuyDoi(confirmed.san_pham_cat_2)}
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-zinc-900 text-white">
                        <td colSpan={7} className="px-2 py-2 text-right font-black">TỔNG</td>
                        <td className="px-2 py-2 text-right font-black">{fmtQty(totals.qty)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[11px] font-semibold text-zinc-500">
                  Đổi độ li thì tên và do_day_m của sản phẩm cắt ghép lại theo số li mới (1 → 1m). Phần còn lại giữ độ dày mẹ. Bỏ trống độ li hoặc m dài = giữ nguyên của mẹ. Khi đủ thông tin, bấm Xác nhận ở đầu danh sách để xem sản phẩm cắt và phần còn lại nằm ở kho nào.
                </p>
              </section>

              {modalError && <p className="text-xs font-bold text-red-600">{modalError}</p>}

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-bold text-zinc-600">
                  Đóng
                </button>
                <button
                  onClick={handleSaveModal}
                  disabled={saving || !canSave}
                  className="flex items-center gap-1 rounded-lg bg-[#ef1b2d] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {editingId ? 'Lưu sửa' : 'Lưu lệnh'} ({lines.length} SP)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WarehouseSlipPrintModal open={Boolean(printSlips?.length)} slips={printSlips} onClose={() => setPrintSlips(null)} />
    </div>
  );
}
