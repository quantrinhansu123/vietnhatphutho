import React, { useState } from 'react';
import { ChevronDown, ImagePlus, Loader2, Plus, RefreshCw, ScanBarcode, Trash2 } from 'lucide-react';
import ProductQrScanner from '../../components/ProductQrScanner';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import WeighingImagePreviewModal, { WeighingImageThumbnail, type WeighingPreviewImage } from '../../components/WeighingImagePreviewModal';
import { VnCalendarPicker } from '../so-che-do-may';
import { insertWarehouseLineByClass } from '../phieu-xuat-nhap-kho/nvlSlipLogic';
import type { MaterialOption } from '../san-pham/types';
import { fileToOptimizedImageDataUrl, uploadImage } from '../_shared/recordHelpers';
import { CAMERA_IMAGE_INPUT_PROPS } from '../../utils/cameraCapture';
import {
  emptyChiPhiKemTheo,
  roundKem,
  sumKemDraft,
  type ChiPhiKemTheoDraft
} from './chiPhiKemTheo';
import { normalizeWarehouseMaterialClass } from '../../utils/warehouseNormMerge';
import { isWarehouseKgUnit } from '../../utils/warehouseWeight';
import { formatMoney, formatNumber, parseLocalizedNumber } from '../../utils';

export type XuatNvlClass = 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai';

export type { ChiPhiKemTheoDraft as ChiPhiKemTheo };

export type XuatNvlLine = {
  key: string;
  /** Nơi nhận của dòng: kho hoặc máy. Phiếu xuất tổng hợp để đích ở header. */
  khoLoai: 'kho' | 'may';
  khoId: string;
  /** Phiếu xuất: nguồn lấy hàng của dòng, kho hoặc máy. */
  srcLoai: 'kho' | 'may';
  srcId: string;
  warehouseClass: XuatNvlClass;
  materialId: string;
  maHang: string;
  tenHang: string;
  tenSanXuat: string;
  donVi: string;
  nhomVthh: string;
  auxiliaryGroup: string;
  ngayDong: string;
  caDong: string;
  tonDau: number | null;
  tonDauDirty: boolean;
  slCt: string;
  soLuong: string;
  donGia: string;
  chiPhiKemTheo: ChiPhiKemTheoDraft[];
  normPerKg?: number;
  imageUrl: string;
  imagePublicId: string;
  isScanned: boolean;
};

const gridCols =
  'grid-cols-[2.25rem_5.75rem_minmax(12rem,1.1fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.95fr)_minmax(6rem,0.85fr)_3.25rem_9rem_6.25rem_5.5rem_4.25rem_5.75rem_5rem_4.25rem_5.5rem_2rem]';
const headerGrid = `mb-1 grid min-w-[114rem] ${gridCols} items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-2 py-2`;
const lineGrid = `grid min-w-[114rem] ${gridCols} items-center gap-1.5 border-b border-zinc-200/80 py-1.5`;
const head = 'text-[10px] font-black uppercase tracking-wide text-white';
const field = 'h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]';

type KhoOption = { id: string; label: string };
type CatalogMaterial = MaterialOption & { tenKho?: string };

function sourceChoiceLabel(item: KhoOption, kind: 'kho' | 'may') {
  if (kind !== 'may') return item.label;
  const split = item.label.split(' — ');
  if (split.length < 2) return item.label;
  const code = split[0].trim();
  const name = split.slice(1).join(' — ').trim();
  return name ? `${name} (${code})` : item.label;
}

function materialRowId(item: MaterialOption) {
  const id = String(item.id || '').trim();
  if (id) return id;
  return [item.code, item.name, item.productionName || ''].join('\u0001');
}

function materialMenuLabel(item: MaterialOption) {
  const sxName = String(item.productionName || '').trim();
  return sxName && sxName.toLocaleLowerCase('vi') !== item.name.toLocaleLowerCase('vi')
    ? `${item.code} · ${item.name} · ${sxName}`
    : `${item.code} · ${item.name}`;
}

function classLabel(value: string) {
  const kind = normalizeWarehouseMaterialClass(value);
  if (kind === 'nvl_chinh') return 'Nguyên vật liệu chính';
  if (kind === 'nvl_phu') return 'Nguyên vật liệu phụ';
  return 'Chưa phân loại';
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ChiPhiKemTheoPanel({
  items,
  lineAmount,
  onChange,
  disabled
}: {
  items: ChiPhiKemTheoDraft[];
  lineAmount: number;
  onChange: (next: ChiPhiKemTheoDraft[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const kem = sumKemDraft(items);
  const tongDong = roundKem(lineAmount + kem);
return (
    <div className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
      <button
        type="button"
        onClick={disabled ? undefined : () => setOpen(current => !current)}
        disabled={disabled}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-extrabold ${
          disabled ? 'text-zinc-400 cursor-not-allowed' : 'text-zinc-700'
        }`}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
        Chi phí ({items.length})
        <span className="font-semibold text-zinc-500">Tổng chi phí đi kèm {formatMoney(kem, 0)}</span>
        <span className="font-semibold text-zinc-900">Tổng thành tiền {formatMoney(tongDong, 0)}</span>
      </button>
      {open && !disabled ? (
        <div className="mt-2 space-y-1">
          {items.map(item => (
            <div key={item.id} className="grid grid-cols-[minmax(8rem,1fr)_7rem_7rem_1.75rem] items-center gap-1">
              <input
                value={item.ten}
                placeholder="Nhập tên chi phí"
                onChange={disabled ? undefined : event => {
                  const ten = event.target.value.slice(0, 120);
                  onChange(items.map(row => (row.id === item.id ? { ...row, ten } : row)));
                }}
                disabled={disabled}
                className={field}
              />
              <input
                value={item.donGia}
                inputMode="decimal"
                placeholder="Đơn giá"
                onChange={disabled ? undefined : event => onChange(items.map(row => (row.id === item.id ? { ...row, donGia: event.target.value } : row)))}
                onBlur={disabled ? undefined : event => {
                  if (!event.target.value.trim()) return;
                  const parsed = parseLocalizedNumber(event.target.value);
                  if (Number.isFinite(parsed)) onChange(items.map(row => (row.id === item.id ? { ...row, donGia: formatMoney(parsed, 0) } : row)));
                }}
                disabled={disabled}
                className={`${field} text-right`}
              />
              <input
                value={item.thanhTien}
                inputMode="decimal"
                placeholder="Thành tiền"
                onChange={disabled ? undefined : event => onChange(items.map(row => (row.id === item.id ? { ...row, thanhTien: event.target.value } : row)))}
                onBlur={disabled ? undefined : event => {
                  if (!event.target.value.trim()) return;
                  const parsed = parseLocalizedNumber(event.target.value);
                  if (Number.isFinite(parsed)) onChange(items.map(row => (row.id === item.id ? { ...row, thanhTien: formatMoney(parsed, 0) } : row)));
                }}
                disabled={disabled}
                className={`${field} text-right`}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter(row => row.id !== item.id))}
                  className="text-rose-600"
                  aria-label="Xóa chi phí"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, { id: newKey(), ten: '', donGia: '', thanhTien: '' }])}
            className="text-xs font-extrabold text-blue-600"
          >
            + Thêm chi phí
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function emptyXuatNvlFields(patch?: Partial<XuatNvlLine>): XuatNvlLine {
  return {
    key: newKey(),
    khoLoai: 'kho',
    khoId: '',
    srcLoai: 'kho',
    srcId: '',
    warehouseClass: 'chua_phan_loai',
    materialId: '',
    maHang: '',
    tenHang: '',
    tenSanXuat: '',
    donVi: '',
    nhomVthh: '',
    auxiliaryGroup: '',
    ngayDong: '',
    caDong: '',
    tonDau: null,
    tonDauDirty: false,
    slCt: '',
    soLuong: '',
    donGia: '',
    chiPhiKemTheo: [],
    normPerKg: undefined,
    imageUrl: '',
    imagePublicId: '',
    isScanned: false,
    ...patch
  };
}

export function XuatNvlDetail({
  lines,
  sourceWarehouses,
  machines,
  materials,
  materialsForSource,
  shiftOptions,
  defaultTonNgay,
  onChange,
  onRefreshCatalog,
  refreshing,
  viewOnly
}: {
  lines: XuatNvlLine[];
  sourceWarehouses: KhoOption[];
  machines: KhoOption[];
  materials: CatalogMaterial[];
  materialsForSource: (srcId: string) => MaterialOption[];
  shiftOptions: string[];
  defaultTonNgay: string;
  onChange: (lines: XuatNvlLine[]) => void;
  onRefreshCatalog: () => void;
  refreshing: boolean;
  viewOnly?: boolean;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [viewing, setViewing] = useState<WeighingPreviewImage | null>(null);
  const [uploadError, setUploadError] = useState('');

  function patchAt(index: number, patch: Partial<XuatNvlLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function applyMaterial(index: number, item: MaterialOption) {
    const unit = String(item.unit || '').trim();
    const per = parseLocalizedNumber(item.totalWeight || '');
    patchAt(index, {
      materialId: materialRowId(item),
      maHang: item.code,
      tenHang: item.name,
      tenSanXuat: String(item.productionName || '').trim(),
      donVi: unit,
      auxiliaryGroup: String(item.nhomVatTuPhu || '').trim(),
      normPerKg: isWarehouseKgUnit(unit) ? 1 : Number.isFinite(per) && per > 0 ? per : undefined,
      tonDau: null,
      tonDauDirty: false
    });
  }

  function findMaterial(id: string, pool: MaterialOption[]) {
    return pool.find(item => materialRowId(item) === id);
  }

  function materialKnown(id: string, pool: MaterialOption[]) {
    const key = id.trim();
    return Boolean(key) && pool.some(item => materialRowId(item) === key);
  }

  function productionOptions(pool: MaterialOption[], code: string, currentId: string, currentName: string) {
    const key = code.trim().toLocaleLowerCase('vi');
    const rows = pool.filter(item =>
      item.code.trim().toLocaleLowerCase('vi') === key && String(item.productionName || '').trim()
    );
    if (currentId && rows.some(item => materialRowId(item) === currentId)) return rows;
    const name = currentName.trim();
    if (!name) return rows;
    const sameName = rows.find(item => String(item.productionName || '').trim() === name);
    if (sameName) return rows;
    return [...rows, { id: currentId || name, code, name: '', productionName: name, unit: '' } as MaterialOption];
  }

  function blankLine(patch?: Partial<XuatNvlLine>) {
    return emptyXuatNvlFields(patch);
  }

  function addClass(kind: XuatNvlClass) {
    const draft = blankLine({ warehouseClass: kind });
    onChange(insertWarehouseLineByClass(lines.length ? lines : [], draft));
  }

  function onScan(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const prefix = code.includes('_') ? code.slice(0, code.indexOf('_')).trim() : code;
    const matches = materials.filter(item => {
      const token = item.code.toLocaleLowerCase('vi');
      return token === code.toLocaleLowerCase('vi') || token === prefix.toLocaleLowerCase('vi');
    });
    if (matches.length !== 1) {
      setUploadError(matches.length
        ? `Mã ${prefix} có ${matches.length} dòng trong kho này. Hãy chọn đúng dòng trong danh sách.`
        : `Không thấy mã ${code} trong kho này.`);
      return;
    }
    const found = matches[0];
    const hit = lines.findIndex(line => line.maHang.trim().toLocaleLowerCase('vi') === found.code.trim().toLocaleLowerCase('vi'));
    if (hit >= 0) {
      const current = parseLocalizedNumber(lines[hit].soLuong) || 0;
      patchAt(hit, { soLuong: String(Math.round((current + 1) * 1000) / 1000), isScanned: true });
      return;
    }
    const unit = String(found.unit || '').trim();
    const per = parseLocalizedNumber(found.totalWeight || '');
    onChange([
      ...lines.filter(line => line.maHang.trim()),
      blankLine({
        maHang: found.code,
        tenHang: found.name,
        tenSanXuat: String(found.productionName || '').trim(),
        donVi: unit,
        materialId: String(found.id || '').trim(),
        srcLoai: 'kho',
        srcId: String(found.tenKho || '').trim(),
        auxiliaryGroup: String(found.nhomVatTuPhu || '').trim(),
        soLuong: '1',
        isScanned: true,
        normPerKg: isWarehouseKgUnit(unit) ? 1 : Number.isFinite(per) && per > 0 ? per : undefined
      })
    ]);
  }

  async function uploadPhoto(index: number, file: File) {
    const line = lines[index];
    if (!line) return;
    setUploadingKey(line.key);
    setUploadError('');
    try {
      const dataUrl = await fileToOptimizedImageDataUrl(file);
      const uploaded = await uploadImage(dataUrl, 'phieu_xuat_nhap_kho');
      patchAt(index, { imageUrl: uploaded.imageUrl, imagePublicId: uploaded.imagePublicId });
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : 'Không tải được ảnh số cân.');
    } finally {
      setUploadingKey('');
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Chi tiết NVL</p>
        {!viewOnly && (
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d] bg-[#ef1b2d] px-2.5 text-[11px] font-extrabold text-white"
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              Quét ĐT
            </button>
            <button
              type="button"
              onClick={() => addClass('nvl_chinh')}
              className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-extrabold text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm NVL chính
            </button>
            <button
              type="button"
              onClick={() => addClass('nvl_phu')}
              className="flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-extrabold text-violet-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm NVL phụ
            </button>
            <button
              type="button"
              onClick={onRefreshCatalog}
              disabled={refreshing}
              className="flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-extrabold text-emerald-800 disabled:opacity-60"
              title="Tải lại cột Tổng kg từ kho NVL"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Làm mới Tổng kg
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Xóa hết tất cả các dòng NVL trong phiếu?')) return;
                onChange([blankLine()]);
              }}
              className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-extrabold text-zinc-700 hover:border-red-200 hover:bg-red-50 hover:text-[#ef1b2d]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa hết
            </button>
          </div>
        )}
      </div>

      <div className="scrollbar-hidden overflow-x-auto">
        <div className={headerGrid}>
          <span className={`${head} text-center`}>STT</span>
          <span className={head}>Loại</span>
          <span className={head}>Xuất từ</span>
          <span className={head}>Mã nguyên vật liệu</span>
          <span className={head}>Tên nguyên vật liệu</span>
          <span className={head}>Tên sản xuất</span>
          <span className={head}>ĐVT</span>
          <span className={head}>Ngày tồn</span>
          <span className={head}>Ca</span>
          <span className={head}>Tồn đầu ca</span>
          <span className={head}>SL CT</span>
          <span className={head}>SL Thực</span>
          <span className={head}>Quy đổi KG</span>
          <span className={head}>Giá</span>
          <span className={`${head} text-right`}>Thành tiền</span>
          <span />
        </div>
        {lines.map((line, index) => {
          const showGroup = index === 0 || normalizeWarehouseMaterialClass(line.warehouseClass) !== normalizeWarehouseMaterialClass(lines[index - 1]?.warehouseClass);
          const qty = parseLocalizedNumber(line.soLuong);
          const price = parseLocalizedNumber(line.donGia);
          const amount = Number.isFinite(qty) && Number.isFinite(price) ? Math.round(qty * price * 1000) / 1000 : 0;
          const amountText = formatMoney(amount, 0);
          const kg = !Number.isFinite(qty) || qty <= 0
            ? 0
            : isWarehouseKgUnit(line.donVi)
              ? Math.round(qty * 1000) / 1000
              : line.normPerKg && line.normPerKg > 0
                ? Math.round(qty * line.normPerKg * 1000) / 1000
                : 0;
          const sourceKind = line.srcLoai === 'may' ? 'may' : 'kho';
          const sourceMaterials = sourceKind === 'may' ? materials : materialsForSource(line.srcId);
          const sxText = String(line.tenSanXuat || '').trim();
          const knownMaterial = materialKnown(line.materialId, sourceMaterials);
          const codeValue = knownMaterial ? line.materialId : line.maHang;
          const sxValue = sxText ? (knownMaterial ? line.materialId : sxText) : '';
          const needsWarehousePick = Boolean(line.maHang.trim()) && !knownMaterial;
          const inputId = `tong-hop-can-${line.key}`;
          return (
            <React.Fragment key={line.key}>
              {showGroup ? (
                <div className="mb-1 mt-2 flex items-center rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-700 first:mt-0">
                  {classLabel(line.warehouseClass)}
                </div>
              ) : null}
              <div className={lineGrid}>
                <div className="flex items-center justify-center text-xs font-bold text-zinc-500">{index + 1}</div>
                <select
                  value={sourceKind}
                  disabled={viewOnly}
                  onChange={viewOnly ? undefined : event => {
                    const nextKind = event.target.value === 'may' ? 'may' : 'kho';
                    if (nextKind === sourceKind) return;
                    patchAt(index, {
                      srcLoai: nextKind,
                      srcId: '',
                      materialId: '',
                      maHang: '',
                      tenHang: '',
                      tenSanXuat: '',
                      donVi: '',
                      auxiliaryGroup: '',
                      tonDau: null,
                      tonDauDirty: false
                    });
                  }}
                  className={field}
                  aria-label="Loại xuất từ"
                >
                  <option value="kho">Kho</option>
                  <option value="may">Máy</option>
                </select>
                <SearchableSelect
                  value={line.srcId}
                  onChange={viewOnly ? undefined : value => {
                    if (value === line.srcId) return;
                    patchAt(index, {
                      srcLoai: sourceKind,
                      srcId: value,
                      materialId: '',
                      maHang: '',
                      tenHang: '',
                      tenSanXuat: '',
                      donVi: '',
                      auxiliaryGroup: '',
                      tonDau: null,
                      tonDauDirty: false
                    });
                  }}
                  options={sourceKind === 'may' ? machines : sourceWarehouses}
                  getValue={item => (item as KhoOption).id}
                  getLabel={item => sourceChoiceLabel(item as KhoOption, sourceKind)}
                  getSearchText={item => (item as KhoOption).label}
                  placeholder={sourceKind === 'may' ? 'Chọn máy' : 'Chọn kho'}
                  disabled={viewOnly}
                  inputClassName={field}
                  comboboxMode
                  comboboxSearchable
                  openUpward
                />
                <SearchableSelect
                  value={codeValue}
                  onChange={viewOnly ? undefined : value => {
                    const found = findMaterial(value, sourceMaterials);
                    if (found) applyMaterial(index, found);
                  }}
                  options={sourceMaterials}
                  getValue={item => materialRowId(item as MaterialOption)}
                  getLabel={item => (item as MaterialOption).code}
                  getOptionLabel={item => materialMenuLabel(item as MaterialOption)}
                  getSearchText={item => materialMenuLabel(item as MaterialOption)}
                  placeholder={line.srcId ? 'Mã NPL' : 'Chọn xuất từ trước'}
                  inputClassName={`${field} ${needsWarehousePick ? 'border-amber-300 bg-amber-50' : ''}`}
                  comboboxMode
                  comboboxSearchable
                  openUpward
                  disabled={viewOnly || !line.srcId}
                />
                <div className="truncate text-[11px] font-semibold text-zinc-700" title={line.tenHang}>{line.tenHang || '—'}</div>
                <div>
                  <SearchableSelect
                    value={sxValue}
                    onChange={viewOnly ? undefined : value => {
                      const found = findMaterial(value, sourceMaterials);
                      if (found) applyMaterial(index, found);
                    }}
                    options={productionOptions(sourceMaterials, line.maHang, knownMaterial ? line.materialId : '', sxText)}
                    getValue={item => materialRowId(item as MaterialOption)}
                    getLabel={item => String((item as MaterialOption).productionName || '').trim()}
                    placeholder={line.maHang ? (needsWarehousePick ? 'Chọn tên SX trong kho xuất' : 'Không có dữ liệu') : 'Chọn mã NPL trước'}
                    disabled={!line.maHang.trim() || viewOnly}
                    inputClassName={`${field} ${needsWarehousePick ? 'border-amber-300 bg-amber-50' : ''}`}
                    comboboxMode
                    comboboxSearchable
                    openUpward
                  />
                </div>
                <div className="truncate px-1.5 text-[11px] font-semibold text-zinc-700" title={line.donVi}>{line.donVi || '—'}</div>
                <div className="min-w-0">
                  <VnCalendarPicker
                    compact
                    openUpward
                    value={line.ngayDong || defaultTonNgay}
                    onChange={viewOnly ? undefined : value => patchAt(index, { ngayDong: value, tonDau: null, tonDauDirty: false })}
                    disabled={viewOnly}
                  />
                </div>
                <select
                  value={line.caDong}
                  onChange={viewOnly ? undefined : event => patchAt(index, { caDong: event.target.value, tonDau: null, tonDauDirty: false })}
                  disabled={viewOnly}
                  className={field}
                  aria-label="Ca"
                >
                  <option value="">Ca</option>
                  {shiftOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <input
                  value={line.tonDau === null ? '' : String(line.tonDau)}
                  onChange={viewOnly ? undefined : event => {
                    const parsed = parseLocalizedNumber(event.target.value);
                    patchAt(index, {
                      tonDau: event.target.value.trim() && Number.isFinite(parsed) ? parsed : null,
                      tonDauDirty: true
                    });
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  title="Tồn đầu ca"
                  aria-label="Tồn đầu ca"
                  disabled={viewOnly}
                  className={`${field} text-right tabular-nums ${line.tonDauDirty ? '' : 'border-sky-200 bg-sky-50/50'}`}
                />
                <input value={line.slCt} onChange={viewOnly ? undefined : event => patchAt(index, { slCt: event.target.value })} onBlur={viewOnly ? undefined : event => {
                  if (!event.target.value.trim()) return;
                  const parsed = parseLocalizedNumber(event.target.value);
                  if (Number.isFinite(parsed)) patchAt(index, { slCt: formatNumber(parsed, 3) });
                }} disabled={viewOnly} className={field} />
                <input value={line.soLuong} onChange={viewOnly ? undefined : event => patchAt(index, { soLuong: event.target.value })} onBlur={viewOnly ? undefined : event => {
                  if (!event.target.value.trim()) return;
                  const parsed = parseLocalizedNumber(event.target.value);
                  if (Number.isFinite(parsed)) patchAt(index, { soLuong: formatNumber(parsed, 3) });
                }} disabled={viewOnly} className={`${field} border-emerald-200 bg-emerald-50/50`} />
                <div className={`${field} flex items-center bg-emerald-50/60 font-mono font-bold text-emerald-800`}>{formatNumber(kg || 0, 3)}</div>
                <input value={line.donGia} onChange={viewOnly ? undefined : event => patchAt(index, { donGia: event.target.value })} onBlur={viewOnly ? undefined : event => {
                  if (!event.target.value.trim()) return;
                  const parsed = parseLocalizedNumber(event.target.value);
                  if (Number.isFinite(parsed)) patchAt(index, { donGia: formatMoney(parsed, 0) });
                }} disabled={viewOnly} className={field} />
                <div className="text-right font-mono text-[11px] font-bold tabular-nums">{amountText}</div>
                {!viewOnly && (
                  <button type="button" onClick={() => onChange(lines.filter((_, i) => i !== index).length ? lines.filter((_, i) => i !== index) : [blankLine()])} className="text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <ChiPhiKemTheoPanel
                items={line.chiPhiKemTheo || []}
                lineAmount={amount}
                onChange={viewOnly ? undefined : next => patchAt(index, { chiPhiKemTheo: next })}
                disabled={viewOnly}
              />
              {!line.isScanned ? (
                <div className="mb-2 rounded-lg border border-red-100 bg-red-50/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-zinc-600">
                      <ImagePlus className="h-3.5 w-3.5 text-[#ef1b2d]" />
                      Ảnh số cân thực tế
                    </span>
                    {line.imageUrl ? (
                      <button type="button" onClick={() => setViewing({ url: line.imageUrl, title: `Ảnh số cân · ${line.maHang || 'NVL'}` })} className="text-[10px] font-bold text-[#ef1b2d] underline">
                        Xem ảnh
                      </button>
                    ) : null}
                  </div>
                  <input
                    id={inputId}
                    {...CAMERA_IMAGE_INPUT_PROPS}
                    disabled={uploadingKey === line.key || viewOnly}
                    className="hidden"
                    onChange={viewOnly ? undefined : event => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      if (file) void uploadPhoto(index, file);
                    }}
                  />
                  <label htmlFor={inputId} className={`mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-bold ${viewOnly ? 'bg-zinc-50 text-zinc-400 cursor-not-allowed' : 'bg-white text-zinc-700 cursor-pointer'}`}>
                    {uploadingKey === line.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploadingKey === line.key ? 'Đang tải ảnh...' : line.imageUrl ? 'Chụp lại' : 'Chụp ảnh'}
                  </label>
                  {line.imageUrl ? (
                    <WeighingImageThumbnail
                      url={line.imageUrl}
                      alt="Ảnh số cân thực tế"
                      title="Ảnh số cân thực tế"
                      onView={() => setViewing({ url: line.imageUrl, title: `Ảnh số cân · ${line.maHang || 'NVL'}` })}
                      className="mt-1.5 block h-20 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                    />
                  ) : (
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">Có thể lưu phiếu khi chưa chụp ảnh.</p>
                  )}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      {uploadError ? <p className="text-xs font-semibold text-rose-600">{uploadError}</p> : null}
      <ProductQrScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={onScan} closeAfterScan={false} requireConfirm={false} />
      <WeighingImagePreviewModal image={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
