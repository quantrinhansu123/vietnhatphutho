import React, { useState } from 'react';
import { ImagePlus, Loader2, Plus, RefreshCw, ScanBarcode, Trash2 } from 'lucide-react';
import ProductQrScanner from '../../components/ProductQrScanner';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import WeighingImagePreviewModal, { WeighingImageThumbnail, type WeighingPreviewImage } from '../../components/WeighingImagePreviewModal';
import { VnCalendarPicker } from '../so-che-do-may';
import { insertWarehouseLineByClass, resolveWarehouseLineProductionName } from '../phieu-xuat-nhap-kho/nvlSlipLogic';
import type { MaterialOption } from '../san-pham/types';
import { fileToOptimizedImageDataUrl, uploadImage } from '../_shared/recordHelpers';
import { CAMERA_IMAGE_INPUT_PROPS } from '../../utils/cameraCapture';
import { isTapeOrStampMaterial, normalizeNhomVatTuPhuKey, resolveAuxiliaryWeightPerUnit } from '../../utils/mixingNormAuxiliary';
import { normalizeWarehouseMaterialClass } from '../../utils/warehouseNormMerge';
import { isWarehouseKgUnit } from '../../utils/warehouseWeight';

export type XuatNvlClass = 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai';

export type XuatNvlLine = {
  key: string;
  /** Nơi nhận của dòng: kho hoặc máy. */
  khoLoai: 'kho' | 'may';
  khoId: string;
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
  normPerKg?: number;
  imageUrl: string;
  imagePublicId: string;
  isScanned: boolean;
};

const VTHH_OPTIONS = ['TP; PX Rỗng', 'TP; PX Đặc', 'TP; PX Sóng'] as const;

const gridCols =
  'grid-cols-[2.25rem_5.75rem_minmax(12rem,1.25fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.95fr)_minmax(6rem,0.85fr)_3.25rem_5rem_9rem_6.25rem_5.5rem_4.25rem_5.75rem_5rem_4.25rem_5.5rem_2rem]';
const headerGrid = `mb-1 grid min-w-[128rem] ${gridCols} items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-2 py-2`;
const lineGrid = `grid min-w-[128rem] ${gridCols} items-center gap-1.5 border-b border-zinc-200/80 py-1.5`;
const head = 'text-[10px] font-black uppercase tracking-wide text-white';
const field = 'h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-1.5 text-[11px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]';

type KhoOption = { id: string; label: string };

function destLabel(item: KhoOption, kind: 'kho' | 'may') {
  if (kind !== 'may') return item.label;
  const split = item.label.split(' — ');
  if (split.length < 2) return item.label;
  const code = split[0].trim();
  const name = split.slice(1).join(' — ').trim();
  return name ? `${name} (${code})` : item.label;
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

export function emptyXuatNvlFields(patch?: Partial<XuatNvlLine>): XuatNvlLine {
  return {
    key: newKey(),
    khoLoai: 'kho',
    khoId: '',
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
    normPerKg: undefined,
    imageUrl: '',
    imagePublicId: '',
    isScanned: false,
    ...patch
  };
}

export function XuatNvlDetail({
  lines,
  warehouses,
  machines,
  materials,
  shiftOptions,
  defaultTonNgay,
  destLocked,
  defaultKhoLoai,
  defaultKhoId,
  onChange,
  onRefreshCatalog,
  refreshing
}: {
  lines: XuatNvlLine[];
  warehouses: KhoOption[];
  machines: KhoOption[];
  materials: MaterialOption[];
  shiftOptions: string[];
  defaultTonNgay: string;
  /** Xuất theo phiếu tỷ lệ trộn: máy nhận lấy từ lệnh sản xuất, không chọn tay. */
  destLocked?: boolean;
  defaultKhoLoai?: 'kho' | 'may';
  defaultKhoId?: string;
  onChange: (lines: XuatNvlLine[]) => void;
  onRefreshCatalog: () => void;
  refreshing: boolean;
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
    const per = Number(String(item.totalWeight || '').replace(',', '.'));
    patchAt(index, {
      materialId: String(item.id || '').trim(),
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

  function productionOptions(code: string, current: string) {
    const key = code.trim().toLocaleLowerCase('vi');
    const rows = materials
      .filter(item => item.code.trim().toLocaleLowerCase('vi') === key && String(item.productionName || '').trim())
      .map(item => ({ code: item.code, productionName: String(item.productionName || '').trim() }));
    if (current && !rows.some(row => row.productionName === current)) {
      rows.unshift({ code, productionName: current });
    }
    return rows;
  }

  function blankLine(patch?: Partial<XuatNvlLine>) {
    return emptyXuatNvlFields({
      khoLoai: defaultKhoLoai || 'kho',
      khoId: defaultKhoId || '',
      ...patch
    });
  }

  function addClass(kind: XuatNvlClass) {
    const draft = blankLine({ warehouseClass: kind });
    onChange(insertWarehouseLineByClass(lines.length ? lines : [], draft));
  }

  function onScan(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const prefix = code.includes('_') ? code.slice(0, code.indexOf('_')).trim() : code;
    const found =
      materials.find(item => item.code.toLocaleLowerCase('vi') === code.toLocaleLowerCase('vi')) ||
      materials.find(item => item.code.toLocaleLowerCase('vi') === prefix.toLocaleLowerCase('vi'));
    if (!found) {
      setUploadError(`Không thấy mã ${code} trong kho NVL.`);
      return;
    }
    const hit = lines.findIndex(line => line.maHang.trim().toLocaleLowerCase('vi') === found.code.trim().toLocaleLowerCase('vi'));
    if (hit >= 0) {
      const current = Number(String(lines[hit].soLuong).replace(',', '.')) || 0;
      patchAt(hit, { soLuong: String(Math.round((current + 1) * 1000) / 1000), isScanned: true });
      return;
    }
    const unit = String(found.unit || '').trim();
    const per = Number(String(found.totalWeight || '').replace(',', '.'));
    onChange([
      ...lines.filter(line => line.maHang.trim()),
      blankLine({
        maHang: found.code,
        tenHang: found.name,
        tenSanXuat: String(found.productionName || '').trim(),
        donVi: unit,
        materialId: String(found.id || '').trim(),
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
      </div>

      <div className="scrollbar-hidden overflow-x-auto">
        <div className={headerGrid}>
          <span className={`${head} text-center`}>STT</span>
          <span className={head}>Loại kho</span>
          <span className={head}>Nhập đến</span>
          <span className={head}>Mã nguyên vật liệu</span>
          <span className={head}>Tên nguyên vật liệu</span>
          <span className={head}>Tên sản xuất</span>
          <span className={head}>ĐVT</span>
          <span className={head}>Nhóm VTHH</span>
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
          const groupKey = normalizeNhomVatTuPhuKey(line.auxiliaryGroup || line.tenSanXuat || line.tenHang || line.maHang);
          const tape = isTapeOrStampMaterial(groupKey);
          const showGroup = index === 0 || normalizeWarehouseMaterialClass(line.warehouseClass) !== normalizeWarehouseMaterialClass(lines[index - 1]?.warehouseClass);
          const qty = Number(String(line.soLuong).replace(',', '.'));
          const price = Number(String(line.donGia).replace(',', '.'));
          const amount = Number.isFinite(qty) && Number.isFinite(price) ? Math.round(qty * price * 1000) / 1000 : 0;
          const kg = !Number.isFinite(qty) || qty <= 0
            ? 0
            : isWarehouseKgUnit(line.donVi)
              ? Math.round(qty * 1000) / 1000
              : line.normPerKg && line.normPerKg > 0
                ? Math.round(qty * line.normPerKg * 1000) / 1000
                : 0;
          const sx = resolveWarehouseLineProductionName({ code: line.maHang, productionName: line.tenSanXuat }, materials);
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
                  value={line.khoLoai === 'may' ? 'may' : 'kho'}
                  disabled={destLocked}
                  onChange={event => patchAt(index, { khoLoai: event.target.value === 'may' ? 'may' : 'kho', khoId: '' })}
                  className={field}
                  aria-label="Loại kho"
                >
                  <option value="kho">Kho</option>
                  <option value="may">Máy</option>
                </select>
                <SearchableSelect
                  value={line.khoId}
                  onChange={value => patchAt(index, { khoId: value })}
                  options={line.khoLoai === 'may' ? machines : warehouses}
                  getValue={item => (item as KhoOption).id}
                  getLabel={item => destLabel(item as KhoOption, line.khoLoai === 'may' ? 'may' : 'kho')}
                  getSearchText={item => (item as KhoOption).label}
                  placeholder={destLocked ? 'Máy theo lệnh sản xuất' : line.khoLoai === 'may' ? 'Chọn máy' : 'Chọn kho'}
                  disabled={destLocked}
                  inputClassName={field}
                  comboboxMode
                  comboboxSearchable
                  openUpward
                />
                <SearchableSelect
                  value={line.maHang}
                  onChange={value => {
                    const found = materials.find(item => item.code === value);
                    if (found) applyMaterial(index, found);
                    else patchAt(index, { maHang: value });
                  }}
                  onSelectOption={item => {
                    if (item) applyMaterial(index, item as MaterialOption);
                  }}
                  options={materials}
                  getValue={item => (item as MaterialOption).code}
                  getLabel={item => {
                    const row = item as MaterialOption;
                    const sxName = String(row.productionName || '').trim();
                    return sxName && sxName.toLocaleLowerCase('vi') !== row.name.toLocaleLowerCase('vi')
                      ? `${row.code} · ${row.name} · ${sxName}`
                      : `${row.code} · ${row.name}`;
                  }}
                  getSearchText={item => {
                    const row = item as MaterialOption;
                    return `${row.code} ${row.name} ${row.productionName || ''}`;
                  }}
                  placeholder="Mã NPL"
                  displaySelectedAsValue
                  inputClassName={field}
                  comboboxMode
                  comboboxSearchable
                  openUpward
                />
                <div className="truncate text-[11px] font-semibold text-zinc-700" title={line.tenHang}>{line.tenHang || '—'}</div>
                <div>
                  <SearchableSelect
                    value={sx}
                    onChange={value => patchAt(index, { tenSanXuat: value })}
                    onSelectOption={item => {
                      const picked = String((item as { productionName?: string } | null)?.productionName || '').trim();
                      if (!picked) return;
                      const match = materials.find(option =>
                        option.code.trim().toLocaleLowerCase('vi') === line.maHang.trim().toLocaleLowerCase('vi') &&
                        String(option.productionName || '').trim() === picked
                      );
                      if (!match) {
                        patchAt(index, { tenSanXuat: picked });
                        return;
                      }
                      const unit = String(match.unit || '').trim() || line.donVi;
                      const aux = String(match.nhomVatTuPhu || '').trim();
                      const per = isWarehouseKgUnit(unit)
                        ? 1
                        : resolveAuxiliaryWeightPerUnit(normalizeNhomVatTuPhuKey(aux || picked), line.nhomVthh, unit);
                      patchAt(index, {
                        materialId: String(match.id || '').trim(),
                        tenHang: match.name || line.tenHang,
                        donVi: unit,
                        tenSanXuat: picked,
                        auxiliaryGroup: aux,
                        ...(per && per > 0 ? { normPerKg: per } : {})
                      });
                    }}
                    options={productionOptions(line.maHang, sx)}
                    getValue={item => String((item as { productionName: string }).productionName)}
                    getLabel={item => String((item as { productionName: string }).productionName)}
                    placeholder={line.maHang ? 'Không có dữ liệu' : 'Chọn mã NPL trước'}
                    disabled={!line.maHang.trim()}
                    inputClassName={field}
                    comboboxMode
                    comboboxSearchable
                    openUpward
                  />
                </div>
                <input value={line.donVi} onChange={event => patchAt(index, { donVi: event.target.value })} className={field} placeholder="-" />
                <div>
                  {tape ? (
                    <select
                      value={line.nhomVthh}
                      onChange={event => {
                        const nhomVthh = event.target.value;
                        const per = resolveAuxiliaryWeightPerUnit(groupKey, nhomVthh, line.donVi);
                        patchAt(index, { nhomVthh, ...(per && per > 0 ? { normPerKg: per } : {}) });
                      }}
                      className={`${field} ${line.nhomVthh ? '' : 'border-amber-300 bg-amber-50'}`}
                    >
                      <option value="">-- VTHH --</option>
                      {VTHH_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <span className="block text-center text-xs text-zinc-300">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  <VnCalendarPicker
                    compact
                    openUpward
                    value={line.ngayDong || defaultTonNgay}
                    onChange={value => patchAt(index, { ngayDong: value, tonDau: null, tonDauDirty: false })}
                  />
                </div>
                <select
                  value={line.caDong}
                  onChange={event => patchAt(index, { caDong: event.target.value, tonDau: null, tonDauDirty: false })}
                  className={field}
                  aria-label="Ca"
                >
                  <option value="">Ca</option>
                  {shiftOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <input
                  value={line.tonDau === null ? '' : String(line.tonDau)}
                  onChange={event => {
                    const parsed = Number(String(event.target.value).replace(',', '.'));
                    patchAt(index, {
                      tonDau: event.target.value.trim() && Number.isFinite(parsed) ? parsed : null,
                      tonDauDirty: true
                    });
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  title="Tồn đầu ca"
                  aria-label="Tồn đầu ca"
                  className={`${field} text-right tabular-nums ${line.tonDauDirty ? '' : 'border-sky-200 bg-sky-50/50'}`}
                />
                <input value={line.slCt} onChange={event => patchAt(index, { slCt: event.target.value })} className={field} />
                <input value={line.soLuong} onChange={event => patchAt(index, { soLuong: event.target.value })} className={`${field} border-emerald-200 bg-emerald-50/50`} />
                <div className={`${field} flex items-center bg-emerald-50/60 font-mono font-bold text-emerald-800`}>{kg || 0}</div>
                <input value={line.donGia} onChange={event => patchAt(index, { donGia: event.target.value })} className={field} />
                <div className="text-right font-mono text-[11px] font-bold tabular-nums">{amount || 0}</div>
                <button type="button" onClick={() => onChange(lines.filter((_, i) => i !== index).length ? lines.filter((_, i) => i !== index) : [blankLine()])} className="text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
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
                    disabled={uploadingKey === line.key}
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      if (file) void uploadPhoto(index, file);
                    }}
                  />
                  <label htmlFor={inputId} className="mt-1.5 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700">
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
