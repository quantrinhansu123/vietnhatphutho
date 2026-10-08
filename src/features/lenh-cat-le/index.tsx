import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { useTabAccess } from '../../app/useTabAccess';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';
import { normalizeOrders } from '../don-hang';
import { isCutOrderType, orderFieldClass, parseSouthTemFromTenGhep } from '../_shared/orderHelpers';
import type { OrderProductLine, OrderRow } from '../_shared/orderRecordHelpers';
import { normalizeProducts, type ProductRow } from '../san-pham';
import { orderDuplicateDecimalText } from '../don-hang/southWeight';
import { parseLocalizedNumber } from '../../utils';
import { classifyProductPxGroup, extractDoLiDmNumber, normalizeDoLiDm, parseProductionNameParts, parseSongLengthMeters } from '../../utils/productProductionName';
import {
  KHO_CAT_LE,
  KHO_TAI_CHE,
  KHO_THANH_PHAM,
  buildCatLePrintSlips,
  buildCatLeSanPhamLine,
  catDisplayName,
  computeCatLe,
  inferKhoChinhTuNhom,
  normalizeCatLeSanPhamList,
  normalizeDoLiLabel,
  parseMeterInput,
  parseMeterLabel,
  suggestCatLePlan,
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

interface CutLine {
  key: string;
  motherKey: string;
  /** Mã đơn cắt lẻ — điền từ Tự điền đơn hàng. */
  orderCode: string;
  /** Mã AMIS trên đơn. */
  amisCode: string;
  productId: string;
  productionName: string;
  /** Tên sản phẩm trên đơn / danh mục. */
  productName: string;
  tenGhep: string;
  unit: string;
  /** Kg 1 tấm chuẩn (tl cuộn / tấm đủ dài). */
  sheetKg: string;
  nhomVthh: string;
  doLiDmText: string;
  dinhMucKgText: string;
  slBac: string;
  slTrung: string;
  slNam: string;
  tongKgText: string;
  tem: string;
  mauTem: string;
  danTem2Dau: boolean;
  /** Mã hàng đơn khi chưa khớp được tồn nguồn. */
  missingCode: string;
  /** Hạ li đích. Trống = giữ độ li nguồn. */
  doLiText: string;
  /** Hạ khổ đích (m), từ do_day_m. Trống = giữ nguồn. */
  khoRongText: string;
  /** Dài (m) đặt cắt, từ đơn. */
  mDaiText: string;
  /** SL nguồn xuất — tính ngầm, không hiện ô nhập. */
  qtyText: string;
  /** Số TP/nguồn — tính ngầm từ hạ khổ / m cắt dài. */
  soConText: string;
  /** SL thành phẩm cần cắt — ô số lượng duy nhất trên form. */
  conCanText: string;
  kgCanText: string;
  ghiChu: string;
}

const inputClass = orderFieldClass;
const cellInputClass = `${orderFieldClass} px-2 text-right`;
const CUT_PRODUCT_GRID =
  'grid-cols-[9.5rem_minmax(9rem,1fr)_minmax(11rem,1.25fr)_4.5rem_5rem_6rem_8.5rem_6rem_4.5rem_4.5rem_4.5rem_5rem_6rem_6.5rem_6.5rem_5rem_minmax(8rem,1fr)_2.75rem]';
const CUT_PRODUCT_MIN_WIDTH = 'min-w-[2300px]';
const AUTOFILL_PRODUCT_GRID =
  'grid-cols-[7rem_minmax(9rem,1fr)_minmax(11rem,1.25fr)_4.5rem_5rem_6rem_8.5rem_6rem_4.5rem_4.5rem_4.5rem_5rem_6rem_6.5rem_6.5rem_5rem_minmax(8rem,1fr)]';
const AUTOFILL_PRODUCT_MIN_WIDTH = 'min-w-[2220px]';
const autofillReadClass = `${orderFieldClass} bg-zinc-50`;

function doLiDmSo(value: string): string {
  const number = extractDoLiDmNumber(value);
  return number ? orderDuplicateDecimalText(number) : '';
}

/** Độ li hạ đem vào phép cắt: ô hạ li, hoặc Độ li ĐM khi khác độ li tấm chính. */
function doLiHaForLine(line: CutLine, motherDoLi: string): string | null {
  const explicit = normalizeDoLiLabel(line.doLiText);
  const fromDm = normalizeDoLiLabel(doLiDmSo(line.doLiDmText));
  const next = explicit || fromDm;
  if (!next) return null;
  const nextN = parseLocalizedNumber(next.replace(/\s*l?i\s*$/iu, ''));
  const sourceN = parseLocalizedNumber(String(motherDoLi || '').replace(/\s*l?i\s*$/iu, ''));
  if (Number.isFinite(nextN) && Number.isFinite(sourceN) && Math.abs(nextN - sourceN) < 1e-9) return null;
  if (!Number.isFinite(sourceN) && next.toLocaleLowerCase('vi') === normalizeDoLiLabel(motherDoLi).toLocaleLowerCase('vi')) return null;
  return next;
}

function changedAmisCode(sourceCode: string, nextCode: string): string {
  const next = String(nextCode || '').trim();
  const source = String(sourceCode || '').trim();
  if (!next || next.toLocaleLowerCase('vi') === source.toLocaleLowerCase('vi')) return '';
  return next;
}

function lookupProductName(line: CutLine, catalog: ProductRow[], tenGoc: string): string {
  const saved = line.productName.trim();
  if (saved) return saved;
  const root = String(tenGoc || '').trim();
  if (root) return root;
  const wanted = line.amisCode.trim().toLocaleLowerCase('vi');
  const product = catalog.find(item => {
    if (line.productId && item.id === line.productId) return true;
    return [item.amisCode, item.code, item.newCode, item.amisOldCode].some(
      value => String(value || '').trim().toLocaleLowerCase('vi') === wanted
    );
  });
  return String(product?.name || '').trim();
}

const RESULT_GRID = 'grid-cols-[5.5rem_minmax(8rem,0.8fr)_minmax(9rem,1fr)_minmax(12rem,1.4fr)_4rem_4.5rem_4.5rem_6.5rem_5.5rem]';

function CutResultRow({
  label,
  tone,
  code,
  productName,
  productionName,
  qty,
  doLi,
  dai,
  kg,
  m2
}: {
  label: string;
  tone: 'source' | 'cut' | 'rest' | 'none';
  code: string;
  productName: string;
  productionName: string;
  qty: number;
  doLi: string;
  dai: string;
  kg: number;
  m2: number;
}) {
  const toneClass = tone === 'source' ? 'text-sky-800' : tone === 'cut' ? 'text-emerald-800' : tone === 'rest' ? 'text-amber-800' : 'text-zinc-400';
  const cell = 'min-w-0 truncate text-xs font-semibold text-zinc-800';
  const tongKg = qty > 0 && kg > 0 ? kg * qty : 0;
  return (
    <div className={`grid ${RESULT_GRID} items-center gap-2 px-2 py-1.5`}>
      <span className={`text-[11px] font-black ${toneClass}`}>{label}</span>
      <span className={cell} title={code || 'Không đổi mã'}>{code || '—'}</span>
      <span className={cell} title={productName}>{productName || '—'}</span>
      <span className={cell} title={productionName}>{productionName || '—'}</span>
      <span className="text-right text-xs font-black tabular-nums text-zinc-900">{qty > 0 ? fmtQty(qty) : '—'}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-zinc-800">{doLi || '—'}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-zinc-800">{dai || '—'}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-zinc-800" title={kg > 0 ? `1 SP: ${fmtQty(kg)} kg` : ''}>{tongKg > 0 ? `${fmtQty(tongKg)} kg` : '—'}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-zinc-800">{m2 > 0 ? `${fmtQty(m2)} m²` : '—'}</span>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
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
    useWarehouseNameInTitle: true,
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

function cutLineFromSaved(item: CatLeSanPhamLine): CutLine {
  const nguon = item.san_pham_nguon;
  const cat1 = item.san_pham_cat_1;
  const w = parseMeterLabel(cat1.do_day_m);
  const l = parseMeterLabel(cat1.do_dai_m) || (cat1.m_dai > 0 ? cat1.m_dai : null);
  const doLiChanged = Boolean(cat1.do_li) && cat1.do_li !== nguon.do_li;
  const base = newCutLine();
  const piecesSaved = Math.max(
    1,
    Math.floor(Number((item as { so_con_mot_me?: unknown }).so_con_mot_me) || 1)
  );
  const finished = Math.round((Number(nguon.so_luong) || 0) * piecesSaved * 1000) / 1000;
  const slBac = String(item.sl_bac || '').trim();
  const slTrung = String(item.sl_trung || '').trim();
  const slNam = String(item.sl_nam || '').trim();
  const regionSum = [slBac, slTrung, slNam]
    .map(value => parseLocalizedNumber(value))
    .filter(value => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  const ordered = regionSum > 0 ? regionSum : Number(item.sl_can) > 0 ? Number(item.sl_can) : finished;
  const temSaved = parseSouthTemFromTenGhep(cat1.ten_sp || nguon.ten_sp || '');
  return {
    ...base,
    motherKey: '',
    orderCode: '',
    amisCode: nguon.ma_amis || nguon.ma_sp || '',
    productId: nguon.id_san_pham_trong_kho || '',
    productionName: nguon.ten_sp || '',
    productName: nguon.ten_goc || '',
    tenGhep: cat1.ten_sp || '',
    unit: cat1.don_vi || nguon.don_vi || '',
    sheetKg: nguon.kg > 0 ? String(nguon.kg) : '',
    nhomVthh: nguon.nhom_vthh || '',
    doLiDmText: doLiDmSo(nguon.do_li_dm || cat1.do_li_dm || ''),
    dinhMucKgText: String(item.dinh_muc_kg || '').trim(),
    slBac,
    slTrung,
    slNam,
    tongKgText: String(item.tong_kg || '').trim(),
    tem: String(item.tem || temSaved.tem || '').trim(),
    mauTem: String(item.mau_tem || temSaved.mauTem || '').trim(),
    danTem2Dau: Boolean(item.dan_tem_2_dau) || temSaved.danTem2Dau,
    mDaiText: l ? String(l) : '',
    missingCode: '',
    doLiText: doLiChanged ? cat1.do_li.replace(/\s*li\s*$/iu, '') : '',
    khoRongText: w ? String(w) : '',
    qtyText: String(nguon.so_luong || 1),
    soConText: String(piecesSaved),
    conCanText: ordered > 0 ? String(Math.round(ordered * 1000) / 1000) : '',
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
    orderCode: '',
    amisCode: '',
    productId: '',
    productionName: '',
    productName: '',
    tenGhep: '',
    unit: '',
    sheetKg: '',
    nhomVthh: '',
    doLiDmText: '',
    dinhMucKgText: '',
    slBac: '',
    slTrung: '',
    slNam: '',
    tongKgText: '',
    tem: '',
    mauTem: '',
    danTem2Dau: false,
    missingCode: '',
    doLiText: '',
    khoRongText: '',
    mDaiText: '',
    qtyText: '',
    soConText: '',
    conCanText: '',
    kgCanText: '',
    ghiChu: ''
  };
}

function orderFinishedQty(line: OrderProductLine): number {
  const regions = [line.soLuongBac, line.soLuongTrung, line.soLuongNam]
    .map(value => parseLocalizedNumber(value))
    .filter(value => Number.isFinite(value) && value > 0);
  if (regions.length > 0) return regions.reduce((sum, value) => sum + value, 0);
  const qty = parseLocalizedNumber(line.quantity);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function lineIsBlank(line: CutLine): boolean {
  return !line.motherKey && !line.orderCode && !line.amisCode && !line.conCanText.trim() && !line.mDaiText;
}

/** Tem / màu tem / dán 2 đầu trên dòng hoặc trong tên → hậu tố mã `TEM1.5li-MVKH-2DAU`. */
function temArgsFromCutLine(line: CutLine | undefined): { tem: string; mauTem: string; danTem2Dau: boolean } {
  const fromName = parseSouthTemFromTenGhep(line?.tenGhep || line?.productionName || '');
  return {
    tem: String(line?.tem || '').trim() || fromName.tem,
    mauTem: String(line?.mauTem || '').trim() || fromName.mauTem,
    danTem2Dau: Boolean(line?.danTem2Dau) || fromName.danTem2Dau
  };
}

function regionSlTotal(line: CutLine): number {
  const parts = [line.slBac, line.slTrung, line.slNam]
    .map(value => parseLocalizedNumber(value))
    .filter(value => Number.isFinite(value) && value > 0);
  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) * 1000) / 1000;
}

/** Một dòng lệnh từ một dòng đơn cắt lẻ. SL trên form là SL thành phẩm. */
function cutLineFromOrder(order: OrderRow, prodLine: OrderProductLine): CutLine {
  const code = String(prodLine.maAmis || prodLine.productCode || '').trim();
  const cutM = String(prodLine.daiM || prodLine.quyCachMDai || '').trim();
  const finished = orderFinishedQty(prodLine);
  const base = newCutLine();
  return {
    ...base,
    orderCode: order.orderCode,
    amisCode: code,
    productId: String(prodLine.productId || '').trim(),
    productionName: String(prodLine.productionName || '').trim(),
    productName: String(prodLine.productName || '').trim(),
    tenGhep: String(prodLine.tenGhep || '').trim(),
    unit: String(prodLine.unit || 'Tấm').trim(),
    sheetKg: String(prodLine.tlCuon || '').trim(),
    doLiDmText: doLiDmSo(String(prodLine.doLiDm || '')),
    dinhMucKgText: String(prodLine.dinhMucKg || '').trim(),
    slBac: String(prodLine.soLuongBac || '').trim(),
    slTrung: String(prodLine.soLuongTrung || '').trim(),
    slNam: String(prodLine.soLuongNam || '').trim(),
    tongKgText: String(prodLine.tongKg || '').trim(),
    tem: String(prodLine.tem || '').trim(),
    mauTem: String(prodLine.mauTem || '').trim(),
    danTem2Dau: Boolean(prodLine.danTem2Dau),
    missingCode: '',
    motherKey: '',
    khoRongText: String(prodLine.kho || '').replace(/\s*m\s*$/iu, '').trim(),
    mDaiText: cutM.replace(/\s*m\s*$/iu, '').trim(),
    conCanText: finished > 0 ? String(Math.round(finished * 1000) / 1000) : '',
    ghiChu: String(prodLine.note || '').trim()
  };
};

/** Khổ rộng sản phẩm chính (m). */
function motherWidth(mother: CatLeMother): number | null {
  if (mother.a1 > 0 && mother.l1 > 0) return mother.a1 / mother.l1;
  return parseMeterLabel(mother.doDayM);
}

/** Sản phẩm chính trên dòng lệnh — lấy từ danh mục / tên sản xuất, không đối chiếu tồn kho. */
function motherFromCutLine(line: CutLine, catalog: ProductRow[]): CatLeMother | null {
  const code = line.amisCode.trim();
  if (!code) return null;
  const wanted = code.toLocaleLowerCase('vi');
  const product = catalog.find(item => {
    if (line.productId && item.id === line.productId) return true;
    return [item.amisCode, item.code, item.newCode, item.amisOldCode]
      .some(value => String(value || '').trim().toLocaleLowerCase('vi') === wanted);
  });
  const name = line.productionName.trim() || product?.productionName || product?.name || '';
  const group = line.nhomVthh.trim() || product?.group || '';
  const parts = parseProductionNameParts(name, group, code);
  const doDaiM = String(product?.doDaiM || parts.doDaiM || '').trim();
  const doDayM = String(product?.doDayM || parts.doDayM || '').trim();
  const song = classifyProductPxGroup(group) === 'song' || /sóng/iu.test(name) || /^sts/i.test(code);
  const songLength = song ? parseSongLengthMeters(name) : null;
  let length = parseMeterLabel(doDaiM) || lengthFromProductName(name, parseMeterLabel(doDayM));
  let width = parseMeterLabel(doDayM);
  let widthKnown = width != null;
  if (song && songLength) {
    length = songLength;
    // Khổ sóng chỉ khi tên có mét khác mét dài. Không lấy khổ 1m giả của danh mục.
    const widthInName = metersInName(name).find(n => Math.abs(n - songLength) > 0.001) ?? null;
    if (widthInName == null) {
      width = 1;
      widthKnown = false;
    } else {
      width = widthInName;
      widthKnown = true;
    }
  }
  if (!width && song && length) {
    width = 1;
    widthKnown = false;
  }
  if (!length || !width) return null;
  const cutLen = parseMeterInput(line.mDaiText);
  const finished = parseLocalizedNumber(line.conCanText);
  const tongKg = parseLocalizedNumber(line.tongKgText);
  const sheet = parseLocalizedNumber(line.sheetKg);
  let kg1 = sheet > 0 ? sheet : 0;
  if (!(kg1 > 0) && tongKg > 0 && finished > 0 && cutLen && cutLen < length) {
    kg1 = (tongKg / finished) * (length / cutLen);
  }
  if (!(kg1 > 0) && tongKg > 0 && finished > 0) kg1 = tongKg / finished;
  return {
    maSp: code,
    tenSp: name || code,
    donVi: line.unit.trim() || product?.unit || 'Tấm',
    kg1,
    a1: width * length,
    l1: length,
    tenGoc: product?.tenGoc || parts.tenGoc,
    doLi: product?.doLi || parts.doLi,
    doLiDm: product?.doLiDm || parts.doLiDm,
    doDayM: widthKnown ? (doDayM || `${width}m`) : '',
    doDaiM: doDaiM || `${length}m`,
    mang: product?.mang || parts.mang,
    hangPhe: product?.hangPhe || parts.hangPhe,
    maAmis: product?.amisCode || code,
    moTaTem: ''
  };
}

function metersInName(tenSp: string): number[] {
  const values: number[] = [];
  for (const match of String(tenSp || '').matchAll(/(\d+(?:[.,]\d+)?)\s*m\b/giu)) {
    const n = parseMeterLabel(match[1]);
    if (n) values.push(n);
  }
  return values;
}

/** Mét trong tên SP, bỏ token trùng khổ — mét còn lại là m dài. */
function lengthFromProductName(tenSp: string, width: number | null): number | null {
  const values: number[] = [];
  for (const match of String(tenSp || '').matchAll(/(\d+(?:[.,]\d+)?)\s*m\b/giu)) {
    const n = parseMeterLabel(match[1]);
    if (n) values.push(n);
  }
  const rest = width ? values.filter(n => Math.abs(n - width) > 0.001) : values;
  if (rest.length === 0) return null;
  return rest[rest.length - 1];
}

export function LenCatLePanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('lenh-cat-le');
  const [lenhList, setLenhList] = useState<CatLeLenh[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [completingId, setCompletingId] = useState('');
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  // Modal lập lệnh
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmedByKey, setConfirmedByKey] = useState<Record<string, CatLeSanPhamLine>>({});
  const [catalog, setCatalog] = useState<ProductRow[]>([]);
  const [modalError, setModalError] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [timSp, setTimSp] = useState('');
  const [trangThai, setTrangThai] = useState('all');
  const [ngayCat, setNgayCat] = useState(todayISO());
  const [nguoiThucHien, setNguoiThucHien] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [lines, setLines] = useState<CutLine[]>([newCutLine()]);
  // Tạo lệnh từ đơn cắt lẻ (chỉ load Đơn theo quy cách của khách đặt).
  const [cutOrders, setCutOrders] = useState<OrderRow[]>([]);
  const [cutOrdersLoading, setCutOrdersLoading] = useState(false);
  const [showAutofill, setShowAutofill] = useState(false);
  const [autofillDate, setAutofillDate] = useState('');
  const [autofillSearch, setAutofillSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!showModal) return;
    setCutOrders([]);
    setShowAutofill(false);
    setCutOrdersLoading(true);
    fetch('/api/san-pham?format=table')
      .then(res => res.json().catch(() => ({})))
      .then(data => setCatalog(normalizeProducts(data)))
      .catch(() => setCatalog([]));
    fetch('/api/don-hang')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        const rows = normalizeOrders(data).filter(
          order => isCutOrderType(order.orderType) && !order.isDeleted
        );
        setCutOrders(rows);
      })
      .catch(() => setCutOrders([]))
      .finally(() => setCutOrdersLoading(false));
  }, [showModal]);

  const autofillOrders = useMemo(() => {
    const day = autofillDate.trim();
    const q = autofillSearch.trim().toLocaleLowerCase('vi');
    return cutOrders.filter(order => {
      if (day) {
        const raw = String(order.orderDate || order.createdAt || '').slice(0, 10);
        if (raw && raw !== day) return false;
      }
      if (!q) return true;
      const hay = [order.orderCode, order.customer, ...order.products.flatMap(line => [line.productCode, line.productName, line.productionName, line.tenGhep])]
        .map(value => String(value || '').toLocaleLowerCase('vi'))
        .join(' ');
      return hay.includes(q);
    });
  }, [autofillDate, autofillSearch, cutOrders]);

  const autofillProducts = useMemo(() => {
    return autofillOrders
      .filter(order => selectedOrderIds.includes(order.id))
      .flatMap(order => order.products.map((line, index) => ({ order, line, index, key: `${order.id}::${index}` })));
  }, [autofillOrders, selectedOrderIds]);

  const openAutofill = () => {
    setAutofillDate(ngayCat);
    setAutofillSearch('');
    setSelectedOrderIds([]);
    setSelectedProductKeys([]);
    setShowAutofill(true);
  };

  const toggleAutofillOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const on = prev.includes(orderId);
      if (on) {
        setSelectedProductKeys(keys => keys.filter(key => !key.startsWith(`${orderId}::`)));
        return prev.filter(id => id !== orderId);
      }
      return [...prev, orderId];
    });
  };

  const applyAutofill = () => {
    const picked = autofillProducts
      .filter(item => selectedProductKeys.includes(item.key))
      .map(item => cutLineFromOrder(item.order, item.line));
    if (picked.length === 0) {
      setModalError('Vui lòng chọn ít nhất một sản phẩm trong đơn hàng.');
      return;
    }
    setLines(prev => {
      const kept = prev.filter(line => !lineIsBlank(line));
      return kept.length > 0 ? [...kept, ...picked] : picked;
    });
    setConfirmedByKey({});
    setModalError('');
    setShowAutofill(false);
  };

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
    void loadLenh();
  }, [loadLenh]);

  const openModal = () => {
    setEditingId(null);
    setNgayCat(todayISO());
    setNguoiThucHien('');
    setNguoiLap('');
    setLines([newCutLine()]);
    setConfirmedByKey({});
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
    setLines(products.length > 0 ? products.map(item => cutLineFromSaved(item)) : [newCutLine()]);
    setConfirmedByKey({});
    setModalError('');
    setShowModal(true);
  };

  const updateLine = (key: string, patch: Partial<CutLine>) => {
    setConfirmedByKey({});
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setConfirmedByKey({});
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(line => line.key !== key)));
  };

  interface LinePreview {
    mother: CatLeMother | null;
    nhomVthh: string;
    w2: number | null;
    l2: number | null;
    qty: number;
    pieces: number;
    result: ReturnType<typeof computeCatLe> | null;
    error: string;
  }

  const previews: LinePreview[] = useMemo(() => {
    return lines.map(line => {
      const empty: LinePreview = { mother: null, nhomVthh: '', w2: null, l2: null, qty: 0, pieces: 1, result: null, error: '' };
      if (!line.amisCode.trim() && !line.mDaiText.trim() && !line.conCanText.trim()) return empty;
      const mother = motherFromCutLine(line, catalog);
      if (!mother) {
        return { ...empty, error: line.amisCode.trim() ? 'Chưa đủ khổ / dài của sản phẩm chính để xem cắt.' : '' };
      }
      const wanted = line.amisCode.trim().toLocaleLowerCase('vi');
      const product = catalog.find(item =>
        (line.productId && item.id === line.productId) ||
        [item.amisCode, item.code, item.newCode].some(value => String(value || '').trim().toLocaleLowerCase('vi') === wanted)
      );
      const typedWidth = parseMeterInput(line.khoRongText);
      const w2 = typedWidth && typedWidth > 0 ? typedWidth : motherWidth(mother);
      const sourceWidth = parseMeterLabel(mother.doDayM);
      const inferredWidth = mother.a1 > 0 && mother.l1 > 0 ? mother.a1 / mother.l1 : null;
      const labelCutWidth =
        sourceWidth == null &&
        inferredWidth != null &&
        w2 != null &&
        Math.abs(w2 - inferredWidth) > 1e-9;
      const l2 = parseMeterInput(line.mDaiText);
      const finished = parseLocalizedNumber(line.conCanText);
      const namedGroup = line.nhomVthh.trim() || product?.group || '';
      const nhomVthh = classifyProductPxGroup(namedGroup) === 'other' && /sóng/iu.test(line.productionName || mother.tenSp || '')
        ? 'TP; PX Sóng'
        : namedGroup;
      const base = { ...empty, mother, nhomVthh, w2, l2, qty: 0, pieces: 1 };
      if (!w2 || !l2) return { ...base, error: 'Nhập Dài (m).' };
      if (!(finished > 0)) return { ...base, error: 'Nhập SL (tổng).' };
      try {
        const doLiMoi = doLiHaForLine(line, mother.doLi);
        const doLiDmGiu = normalizeDoLiDm(line.doLiDmText, 'li') || null;
        const plan = suggestCatLePlan(mother, { w2, l2, desiredConQty: finished, doLiMoi });
        const result = computeCatLe(
          mother,
          { w2, l2, qty: plan.mothers, doLiMoi, doLiDmGiu, kgCanThucTe: null, pieces: plan.pieces, labelCutWidth },
          { nhomVthh: base.nhomVthh }
        );
        return { ...base, qty: plan.mothers, pieces: plan.pieces, result };
      } catch (err: any) {
        return { ...base, error: err?.message || 'Thông số cắt không hợp lệ.' };
      }
    });
  }, [lines, catalog]);

  const totals = useMemo(() => {
    let qtyCon = 0;
    previews.forEach((preview, index) => {
      if (!preview.result) return;
      const finished = parseLocalizedNumber(lines[index]?.conCanText);
      qtyCon += Number.isFinite(finished) && finished > 0 ? finished : 0;
    });
    return { qtyCon };
  }, [previews, lines]);

  const canSave =
    lines.length > 0 &&
    lines.every((_, index) => {
      const preview = previews[index];
      return preview && preview.mother && preview.result && !preview.error;
    });

  const filteredLenh = useMemo(() => {
    const q = timSp.trim().toLocaleLowerCase('vi');
    return lenhList.filter(row => {
      if (trangThai !== 'all' && String(row.trang_thai || '') !== trangThai) return false;
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
  }, [lenhList, tuNgay, denNgay, timSp, trangThai]);

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
      return buildCatLeSanPhamLine({
        idSanPhamTrongKho: line.productId,
        mother,
        nhomVthh: preview.nhomVthh,
        qty: preview.qty,
        w2: preview.w2 as number,
        l2: preview.l2 as number,
        doLiMoi: doLiHaForLine(line, mother.doLi),
        kgCanThucTe: null,
        pieces: preview.pieces,
        ghiChu: line.ghiChu.trim(),
        doLiDm: line.doLiDmText,
        ...temArgsFromCutLine(line)
      });
    });

  const confirmLine = (key: string, index: number) => {
    if (confirmedByKey[key]) {
      setConfirmedByKey(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const preview = previews[index];
    if (!preview?.mother || !preview.result || preview.error) {
      setModalError(preview?.error || 'Chưa đủ Dài (m) và SL (tổng) để xem sản phẩm cắt ra.');
      return;
    }
    try {
      const built = buildCatLeSanPhamLine({
        idSanPhamTrongKho: lines[index]?.productId || '',
        mother: preview.mother,
        nhomVthh: preview.nhomVthh,
        qty: preview.qty,
        w2: preview.w2 as number,
        l2: preview.l2 as number,
        doLiMoi: lines[index] ? doLiHaForLine(lines[index], preview.mother.doLi) : null,
        kgCanThucTe: null,
        pieces: preview.pieces,
        ghiChu: lines[index]?.ghiChu.trim() || '',
        doLiDm: lines[index]?.doLiDmText,
        ...temArgsFromCutLine(lines[index])
      });
      const tenGhep = lines[index]?.tenGhep.trim();
      if (tenGhep) built.san_pham_cat_1 = { ...built.san_pham_cat_1, ten_sp: tenGhep };
      setConfirmedByKey(prev => ({ ...prev, [key]: built }));
      setModalError('');
    } catch (err: any) {
      setModalError(err?.message || 'Không xem được sản phẩm cắt ra.');
    }
  };

  const handleSaveModal = async () => {
    if (!canSave) {
      setModalError('Còn dòng chưa hợp lệ — kiểm tra Mã AMIS, Dài (m) và SL (tổng).');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const sanPham = lines.map((line, index) => {
        const preview = previews[index];
        const mother = preview.mother as CatLeMother;
        return {
          idSanPhamTrongKho: line.productId,
          maSpNguon: mother.maSp,
          tenSpNguon: mother.tenSp,
          donVi: mother.donVi,
          soLuong: preview.qty,
          kgNguon: mother.kg1,
          m2Nguon: mother.a1,
          mDaiNguon: mother.l1,
          tenGoc: mother.tenGoc,
          doLi: mother.doLi,
          doLiDm: normalizeDoLiDm(line.doLiDmText, 'li') || mother.doLiDm,
          doDayM: mother.doDayM,
          doDaiM: mother.doDaiM,
          mang: mother.mang,
          hangPhe: mother.hangPhe,
          maAmis: mother.maAmis,
          moTaTem: mother.moTaTem || '',
          nhomVthh: preview.nhomVthh,
          mDaiCat: preview.l2,
          khoRongM: preview.w2,
          doLiCat: doLiHaForLine(line, mother.doLi),
          tem: line.tem.trim(),
          mauTem: line.mauTem.trim(),
          danTem2Dau: line.danTem2Dau,
          slCan: parseLocalizedNumber(line.conCanText) || regionSlTotal(line) || null,
          slBac: line.slBac.trim(),
          slTrung: line.slTrung.trim(),
          slNam: line.slNam.trim(),
          dinhMucKg: line.dinhMucKgText.trim(),
          tongKg: line.tongKgText.trim(),
          soConMotMe: preview.pieces,
          kgCanThucTe: null,
          ghiChu: line.ghiChu.trim()
        };
      });
      const payload = {
        ngayCat,
        // Xuất nguồn từ kho chính suy từ nhóm VTHH (Đặc → Kho Đặc; Sóng/Rỗng → Kho Sóng).
        khoNguon:
          inferKhoChinhTuNhom(previews[0]?.nhomVthh || '') || KHO_CAT_LE,
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
        `Duyệt lệnh này? Hệ thống xuất kho chính (Kho Đặc / Kho Sóng theo SP) sản phẩm đang có tồn, nhập kho thành phẩm. Mọi phần còn lại nhập lại kho nguồn. Đồng thời tạo SP biến thể (Mã AMIS mới) trong danh mục. Sau khi duyệt không sửa được.`
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
          ? 'Đã duyệt — phần còn lại nhập lại Kho cắt lẻ.'
          : 'Đã duyệt và ghi phiếu xuất / nhập.',
        'success'
      );
      if (record) openPrint(record);
      void loadLenh();
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
            Một lệnh nhiều sản phẩm. Lưu và sửa không ghi kho — bấm Duyệt mới xuất {KHO_CAT_LE} sản phẩm đang có tồn, nhập {KHO_THANH_PHAM}. Mọi phần còn lại nhập lại {KHO_CAT_LE}. Sau khi duyệt không sửa được.
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
          <label className="w-44 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
            <select
              value={trangThai}
              onChange={e => setTrangThai(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
            >
              <option value="all">Tất cả</option>
              <option value="moi">Chờ duyệt</option>
              <option value="hoan_thanh">Đã duyệt</option>
              <option value="huy">Đã hủy</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
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
          {(tuNgay || denNgay || timSp.trim() || trangThai !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setTuNgay('');
                setDenNgay('');
                setTimSp('');
                setTrangThai('all');
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
                <th className="px-3 py-2 text-right">SL thành phẩm</th>
                <th className="px-3 py-2">Người TH</th>
                <th className="px-3 py-2">Người lập</th>
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
                const cat1 = products
                  .map(item =>
                    catDisplayName(
                      item.san_pham_cat_1.ten_sp,
                      item.san_pham_nguon.mo_ta_tem,
                      item.san_pham_nguon.ten_sp
                    )
                  )
                  .filter(Boolean)
                  .join(' · ');
                const cat2 = products
                  .map(item =>
                    catDisplayName(
                      item.san_pham_cat_2?.ten_sp || '',
                      item.san_pham_nguon.mo_ta_tem,
                      item.san_pham_nguon.ten_sp
                    )
                  )
                  .filter(Boolean)
                  .join(' · ');
                const soLuongCon = products.reduce(
                  (sum, item) =>
                    sum +
                    (Number(item.so_luong_cat_1) ||
                      (Number(item.san_pham_nguon.so_luong) || 0) * (Number(item.so_con_mot_me) || 1)),
                  0
                );
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
                  <td className="px-3 py-2 text-right font-bold">{fmtQty(soLuongCon)}</td>
                  <td className="px-3 py-2 font-semibold">{row.nguoi_thuc_hien || '—'}</td>
                  <td className="px-3 py-2 font-semibold">{row.nguoi_lap || '—'}</td>
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
                  <td colSpan={11} className="px-3 py-8 text-center font-bold text-zinc-400">
                    {tuNgay || denNgay || timSp.trim() ? 'Chưa có lệnh cắt trong khoảng lọc này.' : 'Chưa có lệnh cắt nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-sm">
          <div className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b bg-white px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">{editingId ? 'Sửa lệnh cắt lẻ' : 'Thêm lệnh cắt lẻ mới'}</h3>
              <span className="text-xs font-semibold text-zinc-500">Cùng cột với đơn cắt lẻ. Xem sau STT để hiện mã mới, tên, SL, trọng lượng và m².</span>
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

              <div className="overflow-x-auto">
                <div className={CUT_PRODUCT_MIN_WIDTH}>
                  <RepeatableLinesBlock
                    title="Sản phẩm"
                    required
                    showColumnHeaders
                    alwaysShowColumnHeaders
                    linesClassName="flex flex-col gap-2"
                    gridTemplateClass={CUT_PRODUCT_GRID}
                    onAdd={() => {
                      setConfirmedByKey({});
                      setLines(prev => [...prev, newCutLine()]);
                    }}
                    addButtonClassName="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                    extraHeaderButtons={
                      <>
                        <button
                          type="button"
                          onClick={openAutofill}
                          disabled={cutOrdersLoading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/25 bg-red-50 px-3 text-[11px] font-extrabold text-[#ef1b2d] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Tự điền từ đơn hàng
                        </button>
                        {canSave && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                showSlipPreview({
                                  ngay_cat: ngayCat,
                                  kho_nguon: inferKhoChinhTuNhom(previews[0]?.nhomVthh || '') || KHO_CAT_LE,
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
                      </>
                    }
                    columns={[
                      { key: 'stt', label: 'STT' },
                      { key: 'code', label: 'Mã AMIS', required: true },
                      { key: 'productionName', label: 'Tên sản xuất' },
                      { key: 'unit', label: 'ĐVT' },
                      { key: 'daiM', label: 'Dài (m)', required: true },
                      { key: 'khoRong', label: 'Hạ khổ rộng (m)' },
                      { key: 'doLi', label: 'Độ li ĐM' },
                      { key: 'dinhMucKg', label: 'Định mức KG' },
                      { key: 'bac', label: 'Bắc' },
                      { key: 'trung', label: 'Trung' },
                      { key: 'nam', label: 'Nam' },
                      { key: 'qty', label: 'SL (tổng)', required: true },
                      { key: 'tongKg', label: 'Tổng KG (nhập)' },
                      { key: 'tem', label: 'Tem' },
                      { key: 'mauTem', label: 'Màu tem' },
                      { key: 'haiDau', label: '2 Đầu' },
                      { key: 'note', label: 'Ghi chú' },
                      { key: 'actions', label: '' }
                    ]}
                  >
                    {lines.map((line, index) => {
                      const preview = previews[index];
                      const confirmed = confirmedByKey[line.key] || null;
                      const regionTotal = regionSlTotal(line);
                      const slTongText = regionTotal > 0 ? String(regionTotal) : line.conCanText;
                      const slNum = parseLocalizedNumber(slTongText);
                      const dmNum = parseLocalizedNumber(line.dinhMucKgText);
                      const tongKgShown = line.tongKgText.trim()
                        ? line.tongKgText
                        : dmNum > 0 && slNum > 0
                          ? String(Math.round(dmNum * slNum * 100) / 100)
                          : '';
                      const patchRegion = (patch: Partial<Pick<CutLine, 'slBac' | 'slTrung' | 'slNam'>>) => {
                        const next = { ...line, ...patch };
                        const any = [next.slBac, next.slTrung, next.slNam].some(value => String(value).trim());
                        const total = regionSlTotal(next);
                        updateLine(line.key, {
                          ...patch,
                          ...(any ? { conCanText: total > 0 ? String(total) : '' } : {})
                        });
                      };
                      return (
                        <div key={line.key} className="space-y-1">
                          <RepeatableLineRow gridTemplateClass={CUT_PRODUCT_GRID} className="!py-2">
                            <div className="flex h-11 items-center gap-1.5">
                              <span className="w-4 shrink-0 text-xs font-black tabular-nums text-zinc-500">{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => confirmLine(line.key, index)}
                                className={`h-8 min-w-0 flex-1 rounded-lg border px-1.5 text-[10px] font-black whitespace-nowrap ${confirmed ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}
                              >
                                {confirmed ? 'Ẩn' : 'Xem'}
                              </button>
                            </div>
                            <input
                              value={line.amisCode}
                              onChange={e => updateLine(line.key, { amisCode: e.target.value, productId: '' })}
                              placeholder="Mã AMIS"
                              className={orderFieldClass}
                            />
                            <input
                              value={line.productionName}
                              onChange={e => updateLine(line.key, { productionName: e.target.value })}
                              placeholder="Tên sản xuất"
                              className={orderFieldClass}
                            />
                            <input
                              value={line.unit}
                              onChange={e => updateLine(line.key, { unit: e.target.value })}
                              placeholder="ĐVT"
                              className={`${orderFieldClass} text-center`}
                            />
                            <input
                              value={line.mDaiText}
                              onChange={e => updateLine(line.key, { mDaiText: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              title="Dài (m) đặt cắt"
                              className={cellInputClass}
                            />
                            <input
                              value={line.khoRongText}
                              onChange={e => updateLine(line.key, { khoRongText: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              title="Hạ khổ rộng (m). Trống = giữ khổ tấm chính. Khổ mới ghi vào mã AMIS."
                              placeholder="Khổ"
                              className={cellInputClass}
                            />
                            <input
                              value={/\(|đm/iu.test(line.doLiDmText) ? doLiDmSo(line.doLiDmText) : line.doLiDmText}
                              onChange={e => updateLine(line.key, { doLiDmText: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              title="Độ li ĐM — chỉ số"
                              className={cellInputClass}
                            />
                            <input
                              value={line.dinhMucKgText}
                              onChange={e => updateLine(line.key, { dinhMucKgText: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              className={cellInputClass}
                            />
                            <input
                              value={line.slBac}
                              onChange={e => patchRegion({ slBac: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              className={cellInputClass}
                            />
                            <input
                              value={line.slTrung}
                              onChange={e => patchRegion({ slTrung: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              className={cellInputClass}
                            />
                            <input
                              value={line.slNam}
                              onChange={e => patchRegion({ slNam: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              className={cellInputClass}
                            />
                            <input value={slTongText} readOnly className={`${cellInputClass} bg-zinc-50 font-black`} placeholder="Tự tính" />
                            <input
                              value={tongKgShown}
                              onChange={e => updateLine(line.key, { tongKgText: e.target.value })}
                              onWheel={e => e.currentTarget.blur()}
                              inputMode="decimal"
                              placeholder="Tổng KG"
                              className={cellInputClass}
                            />
                            <input value={line.tem} onChange={e => updateLine(line.key, { tem: e.target.value })} className={orderFieldClass} />
                            <input value={line.mauTem} onChange={e => updateLine(line.key, { mauTem: e.target.value })} className={orderFieldClass} />
                            <div className="flex h-11 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={line.danTem2Dau}
                                onChange={e => updateLine(line.key, { danTem2Dau: e.target.checked })}
                              />
                            </div>
                            <input
                              value={line.ghiChu}
                              onChange={e => updateLine(line.key, { ghiChu: e.target.value })}
                              placeholder="Ghi chú"
                              className={orderFieldClass}
                            />
                            <div className="flex h-11 items-center justify-end">
                              <button
                                type="button"
                                title="Xóa dòng"
                                onClick={() => removeLine(line.key)}
                                disabled={lines.length <= 1}
                                className="rounded-lg border p-2 text-red-600 disabled:opacity-30"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </RepeatableLineRow>
                          {preview?.error ? (
                            <p className="px-1 text-[11px] font-bold text-red-600">{preview.error}</p>
                          ) : null}
                          {confirmed?.san_pham_cat_1 ? (() => {
                            const xuatChinh = Number(confirmed.san_pham_nguon.so_luong) || 0;
                            const slRa = Number(confirmed.so_luong_cat_1) || 0;
                            const slCan = parseLocalizedNumber(line.conCanText);
                            const slCat = slCan > 0 && slCan < slRa ? slCan : slRa;
                            const slDu = Math.max(0, Math.round((slRa - slCat) * 1000) / 1000);
                            const slThua = confirmed.san_pham_cat_2 ? xuatChinh : 0;
                            const donVi = line.unit.trim() || 'tấm';
                            const conLaiText = slDu > 0 && slThua > 0
                              ? `${fmtQty(slDu)} ${donVi} cắt dư, ${fmtQty(slThua)} ${donVi} thừa`
                              : `${fmtQty(slDu || slThua)} ${donVi}`;
                            const tenSp = lookupProductName(line, catalog, confirmed.san_pham_nguon.ten_goc);
                            const nguon = confirmed.san_pham_nguon;
                            const cat = confirmed.san_pham_cat_1;
                            const daiNguon = nguon.do_dai_m || (nguon.m_dai > 0 ? `${fmtQty(nguon.m_dai)}m` : '');
                            const daiCat = cat.do_dai_m || (cat.m_dai > 0 ? `${fmtQty(cat.m_dai)}m` : '');
                            const maCat = changedAmisCode(line.amisCode, cat.ma_amis || '') || line.amisCode;
                            return (
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50">
                              <div className="grid grid-cols-3 gap-2 border-b border-zinc-300 bg-white px-3 py-2.5">
                                <span className="text-sm font-black text-zinc-950">Xuất tấm chính: {fmtQty(xuatChinh)} {donVi}</span>
                                <span className="text-sm font-black text-emerald-800">Cắt: {fmtQty(slCat)} {donVi}</span>
                                <span className="text-sm font-black text-amber-800">Còn lại: {conLaiText}</span>
                              </div>
                              <div className="overflow-x-auto">
                              <div className="min-w-[1080px]">
                                <div className={`grid ${RESULT_GRID} gap-2 border-b border-zinc-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500`}>
                                  <span />
                                  <span>Mã AMIS</span>
                                  <span>Tên sản phẩm</span>
                                  <span>Tên sản xuất</span>
                                  <span className="text-right">SL</span>
                                  <span className="text-right">Độ li</span>
                                  <span className="text-right">Dài</span>
                                  <span className="text-right">Tổng kg</span>
                                  <span className="text-right">m²</span>
                                </div>
                                <CutResultRow
                                  label="Xuất"
                                  tone="source"
                                  code={nguon.ma_amis || line.amisCode}
                                  productName={tenSp}
                                  productionName={nguon.ten_sp}
                                  qty={xuatChinh}
                                  doLi={nguon.do_li}
                                  dai={daiNguon}
                                  kg={Number(nguon.kg) || 0}
                                  m2={Number(nguon.m2) || 0}
                                />
                                <CutResultRow
                                  label="Cắt"
                                  tone="cut"
                                  code={maCat}
                                  productName={tenSp}
                                  productionName={cat.ten_sp}
                                  qty={slCat}
                                  doLi={cat.do_li}
                                  dai={daiCat}
                                  kg={Number(cat.kg) || 0}
                                  m2={Number(cat.m2) || 0}
                                />
                                {slDu > 0 ? (
                                  <CutResultRow
                                    label="Còn lại"
                                    tone="rest"
                                    code={maCat}
                                    productName={tenSp}
                                    productionName={cat.ten_sp}
                                    qty={slDu}
                                    doLi={cat.do_li}
                                    dai={daiCat}
                                    kg={Number(cat.kg) || 0}
                                    m2={Number(cat.m2) || 0}
                                  />
                                ) : null}
                                {confirmed.san_pham_cat_2 ? (
                                  <CutResultRow
                                    label={slDu > 0 ? 'Thừa' : 'Còn lại'}
                                    tone="rest"
                                    code={changedAmisCode(line.amisCode, confirmed.san_pham_cat_2.ma_amis || '') || line.amisCode}
                                    productName={tenSp}
                                    productionName={confirmed.san_pham_cat_2.ten_sp}
                                    qty={slThua}
                                    doLi={confirmed.san_pham_cat_2.do_li}
                                    dai={confirmed.san_pham_cat_2.do_dai_m || (confirmed.san_pham_cat_2.m_dai > 0 ? `${fmtQty(confirmed.san_pham_cat_2.m_dai)}m` : '')}
                                    kg={Number(confirmed.san_pham_cat_2.kg) || 0}
                                    m2={Number(confirmed.san_pham_cat_2.m2) || 0}
                                  />
                                ) : slDu > 0 ? null : (
                                  <CutResultRow
                                    label="Còn lại"
                                    tone="none"
                                    code=""
                                    productName=""
                                    productionName="Không còn"
                                    qty={0}
                                    doLi=""
                                    dai=""
                                    kg={0}
                                    m2={0}
                                  />
                                )}
                              </div>
                              </div>
                            </div>
                            );
                          })() : null}
                        </div>
                      );
                    })}
                  </RepeatableLinesBlock>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-zinc-500">
                Cột giống đơn cắt lẻ. Bấm Xem để tính xuất, cắt, còn từ tấm chính, mét hạ, độ li hạ và SL (tổng). Mỗi dòng hiện mã, tên, độ li, dài, SL, tổng kg và m². SL (tổng) = Bắc + Trung + Nam.
              </p>

              {modalError && <p className="text-xs font-bold text-red-600">{modalError}</p>}

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-bold text-zinc-600">
                  Hủy
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

      {showAutofill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-zinc-950">Tự điền từ đơn hàng</h4>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                  Chọn đơn cắt lẻ, rồi tick sản phẩm. Các cột giống đơn hàng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAutofill(false)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="shrink-0 border-b border-zinc-100 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="space-y-1.5 sm:w-48">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ngày đơn</span>
                  <VnCalendarPicker value={autofillDate} onChange={setAutofillDate} />
                </label>
                <label className="min-w-0 flex-1 space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Tìm đơn / mã hàng</span>
                  <input
                    value={autofillSearch}
                    onChange={e => setAutofillSearch(e.target.value)}
                    placeholder="Mã đơn, khách, mã hàng..."
                    className={inputClass}
                  />
                </label>
                {autofillDate && (
                  <button
                    type="button"
                    onClick={() => setAutofillDate('')}
                    className="h-10 rounded-lg border px-3 text-xs font-bold text-zinc-600"
                  >
                    Tất cả ngày
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
              {cutOrdersLoading && <p className="text-xs font-semibold text-zinc-500">Đang tải đơn cắt lẻ...</p>}
              {!cutOrdersLoading && autofillOrders.length === 0 && (
                <p className="text-xs font-semibold text-zinc-500">Không có đơn cắt lẻ trong bộ lọc này.</p>
              )}
              <div className="space-y-2">
                {autofillOrders.map(order => {
                  const checked = selectedOrderIds.includes(order.id);
                  return (
                    <label key={order.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAutofillOrder(order.id)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-zinc-900">{order.orderCode}</span>
                        <span className="block text-xs font-semibold text-zinc-500">
                          {order.customer || '—'} · {order.products.length} dòng
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {autofillProducts.length > 0 && (
                <div className="overflow-x-auto">
                  <div className={AUTOFILL_PRODUCT_MIN_WIDTH}>
                    <RepeatableLinesBlock
                      title="Sản phẩm"
                      hideAddButton
                      showColumnHeaders
                      alwaysShowColumnHeaders
                      linesClassName="flex flex-col gap-2"
                      gridTemplateClass={AUTOFILL_PRODUCT_GRID}
                      onAdd={() => undefined}
                      extraHeaderButtons={
                        <button
                          type="button"
                          onClick={() => {
                            const keys = autofillProducts.map(item => item.key);
                            const allOn = keys.every(key => selectedProductKeys.includes(key));
                            setSelectedProductKeys(prev => (allOn ? prev.filter(key => !keys.includes(key)) : [...new Set([...prev, ...keys])]));
                          }}
                          className="text-xs font-bold text-[#ef1b2d]"
                        >
                          {autofillProducts.every(item => selectedProductKeys.includes(item.key)) ? 'Bỏ chọn' : 'Chọn tất cả'}
                        </button>
                      }
                      columns={[
                        { key: 'stt', label: 'STT' },
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'daiM', label: 'Dài (m)', required: true },
                        { key: 'khoRong', label: 'Hạ khổ rộng (m)' },
                        { key: 'doLi', label: 'Độ li ĐM' },
                        { key: 'dinhMucKg', label: 'Định mức KG' },
                        { key: 'bac', label: 'Bắc' },
                        { key: 'trung', label: 'Trung' },
                        { key: 'nam', label: 'Nam' },
                        { key: 'qty', label: 'SL (tổng)', required: true },
                        { key: 'tongKg', label: 'Tổng KG (nhập)' },
                        { key: 'tem', label: 'Tem' },
                        { key: 'mauTem', label: 'Màu tem' },
                        { key: 'haiDau', label: '2 Đầu' },
                        { key: 'note', label: 'Ghi chú' }
                      ]}
                    >
                      {autofillProducts.map((item, index) => {
                        const checked = selectedProductKeys.includes(item.key);
                        const toggle = () =>
                          setSelectedProductKeys(prev =>
                            prev.includes(item.key) ? prev.filter(key => key !== item.key) : [...prev, item.key]
                          );
                        return (
                          <RepeatableLineRow key={item.key} gridTemplateClass={AUTOFILL_PRODUCT_GRID} className="!py-2">
                            <label className="flex h-11 cursor-pointer items-center gap-2">
                              <input type="checkbox" checked={checked} onChange={toggle} />
                              <span className="text-xs font-black tabular-nums text-zinc-500">{index + 1}</span>
                            </label>
                            <input readOnly value={item.line.maAmis || item.line.productCode || ''} className={autofillReadClass} />
                            <input readOnly value={item.line.productionName || item.line.tenGhep || ''} className={autofillReadClass} />
                            <input readOnly value={item.line.unit || ''} className={`${autofillReadClass} text-center`} />
                            <input readOnly value={item.line.daiM || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.kho || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={doLiDmSo(item.line.doLiDm || '')} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.dinhMucKg || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.soLuongBac || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.soLuongTrung || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.soLuongNam || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={fmtQty(orderFinishedQty(item.line))} className={`${autofillReadClass} text-right font-black`} />
                            <input readOnly value={item.line.tongKg || ''} className={`${autofillReadClass} text-right`} />
                            <input readOnly value={item.line.tem || ''} className={autofillReadClass} />
                            <input readOnly value={item.line.mauTem || ''} className={autofillReadClass} />
                            <div className="flex h-11 items-center justify-center">
                              <input type="checkbox" checked={Boolean(item.line.danTem2Dau)} readOnly />
                            </div>
                            <input readOnly value={item.line.note || ''} className={autofillReadClass} />
                          </RepeatableLineRow>
                        );
                      })}
                    </RepeatableLinesBlock>
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAutofill(false)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={applyAutofill}
                className="h-10 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white"
              >
                Điền vào lệnh
              </button>
            </div>
          </div>
        </div>
      )}

      <WarehouseSlipPrintModal open={Boolean(printSlips?.length)} slips={printSlips} onClose={() => setPrintSlips(null)} />
    </div>
  );
}
