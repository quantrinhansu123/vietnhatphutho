import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Printer, Save, Trash2, XCircle } from 'lucide-react';
import {
  MixingNormRatioPrintBatch,
  formatWorkerName,
  type MixingNormRatioPrintDoc
} from './MixingNormRatioPrintSheet';
import { Select2 } from './shared/Select2';
import { waitForPrintImagesReady } from '../utils/printReady';
import { normalizeProducts, type ProductRow } from '../features/san-pham';
import type { MixingNormProduct } from './MixingNormMaterialsTab';

/** Cối trộn tiêu chuẩn (định mức) — chỉ đọc, không cho sửa. */
type StandardLine = {
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_san_xuat: string;
  gia_tri: number | null;
  /** % Cối trộn — ưu tiên lấy từ dữ liệu định mức đã lưu; nếu thiếu (phiếu cũ) suy ra từ khoi_luong/dinh_luong_coi. */
  ty_le_coi: number | null;
  ty_le_tong: number | null;
  tong_khoi_luong: number | null;
};

/** 1 dòng NVL trong 1 cối trộn thực tế do người dùng thêm tay. */
type ActualLine = {
  ma_nvl: string;
  ten_nvl: string;
  phan_tram_thuc_te: number | null;
  trong_luong_thuc_te: number | null;
  trong_luong_thuc_te_input: string;
};

/** 1 "Lần trộn thứ N" — người dùng tự bấm thêm, không tự sinh theo định mức. */
type ActualRound = {
  lan: number;
  tong_trong_luong: number | null;
  tong_trong_luong_input: string;
  nvl: ActualLine[];
};

type ActualProduct = {
  ma_sp: string;
  ten_sp: string;
  ten_san_xuat: string;
  /** Tổng SL sau hao hụt — từ định mức, dùng để cảnh báo/chặn khi tổng các cối thực tế vượt quá. */
  tong_trong_luong: number | null;
  dinh_luong_coi: number | null;
  standardNvl: StandardLine[];
  rounds: ActualRound[];
};

type SecondaryLine = {
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_san_xuat: string;
  khoi_luong_dinh_muc: number | null;
  trong_luong_thuc_te: number | null;
  trong_luong_thuc_te_input: string;
};

type ActualSecondaryProduct = {
  ma_sp: string;
  ten_sp: string;
  lines: SecondaryLine[];
};

type NormRecord = { id: string; ngay: string; ca: string; ma_lenh_sx: string; chi_tiet: unknown };
type ActualRecord = {
  id: string;
  dinh_muc_id: string;
  ngay?: string;
  ca?: string;
  chi_tiet: unknown;
  ghi_chu?: string | null;
};

const STORAGE_KEY = 'actual-mixing-sheet-v1';
const ACTUAL_WEIGHT_FORMAT_ERROR = 'Trọng lượng thực tế không đúng định dạng. Ví dụ: 123.56';
const ACTUAL_WEIGHT_INPUT_PATTERN = /^\d*(?:\.\d{0,2})?$/;

const fieldClass =
  'h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

const numberValue = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const roundTo2 = (value: number) => Math.round(value * 100) / 100;

const formatNumber = (value: number | null) =>
  value === null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);

const formatActualPercent = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);

const recalculateActualPercents = (lines: ActualLine[]): ActualLine[] => {
  const totalActualWeight = lines.reduce((sum, line) => sum + (line.trong_luong_thuc_te ?? 0), 0);
  return lines.map(line => ({
    ...line,
    phan_tram_thuc_te:
      line.trong_luong_thuc_te === null
        ? null
        : totalActualWeight > 0
          ? (line.trong_luong_thuc_te * 100) / totalActualWeight
          : 0
  }));
};

function lineKey(maNvl: string, tenNvl: string) {
  return `${maNvl.trim().toLowerCase()}|${tenNvl.trim().toLowerCase()}`;
}

/** TL ĐM = % Cối trộn tiêu chuẩn × Tổng KL cối thực tế đã nhập ÷ 100 — chỉ để tham chiếu, không lưu riêng. */
function computeTlDm(standard: StandardLine | undefined, tongTrongLuongThucTe: number | null): number | null {
  if (!standard || standard.ty_le_coi === null || tongTrongLuongThucTe === null) return null;
  return roundTo2((standard.ty_le_coi / 100) * tongTrongLuongThucTe);
}

type StandardLineRaw = {
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_san_xuat: string;
  gia_tri: number | null;
  khoi_luong: number | null;
  ty_le_coi: number | null;
  ty_le_tong: number | null;
  tong_khoi_luong: number | null;
};

function parseStandardLine(entry: unknown): StandardLineRaw | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const ma_nvl = String(row.ma_nvl ?? '').trim();
  const ten_nvl = String(row.ten_nvl ?? '').trim();
  if (!ma_nvl && !ten_nvl) return null;
  return {
    ma_nvl,
    ten_nvl,
    ten_nvl_san_xuat: String(row.ten_nvl_san_xuat ?? '').trim(),
    gia_tri: numberValue(row.gia_tri ?? row.dinh_muc),
    khoi_luong: numberValue(row.khoi_luong),
    ty_le_coi: numberValue(row.ty_le_coi),
    ty_le_tong: numberValue(row.ty_le_tong),
    tong_khoi_luong: numberValue(row.tong_khoi_luong)
  };
}

/** Nếu thiếu ty_le_coi (phiếu định mức cũ), suy tạm từ khoi_luong (KL định mức cho 1 cối) / dinh_luong_coi. */
function fillStandardPercents(
  line: StandardLineRaw,
  dinhLuongCoi: number | null,
  tongTrongLuong: number | null
): StandardLine {
  const ty_le_coi =
    line.ty_le_coi !== null
      ? line.ty_le_coi
      : line.khoi_luong !== null && dinhLuongCoi && dinhLuongCoi > 0
        ? (line.khoi_luong / dinhLuongCoi) * 100
        : null;
  const ty_le_tong = line.ty_le_tong ?? ty_le_coi;
  const tong_khoi_luong =
    line.tong_khoi_luong ?? (ty_le_tong !== null && tongTrongLuong ? (ty_le_tong / 100) * tongTrongLuong : null);
  return {
    ma_nvl: line.ma_nvl,
    ten_nvl: line.ten_nvl,
    ten_nvl_san_xuat: line.ten_nvl_san_xuat,
    gia_tri: line.gia_tri,
    ty_le_coi,
    ty_le_tong,
    tong_khoi_luong
  };
}

/** Cối tiêu chuẩn LUÔN lấy từ chi_tiet của phiếu định mức đang chọn — không đọc từ phiếu thực tế đã lưu. */
function normalizeStandardProducts(raw: unknown): ActualProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ActualProduct | null => {
      if (!item || typeof item !== 'object') return null;
      const product = item as Record<string, unknown>;
      if (String(product.loai ?? '').trim() === 'nvl_phu') return null;
      const ma_sp = String(product.ma_sp ?? '').trim();
      const ten_sp = String(product.ten_sp ?? '').trim();
      const ten_san_xuat = String(product.ten_san_xuat ?? product.tenSanXuat ?? '').trim();
      const tong_trong_luong = numberValue(product.tong_trong_luong);
      const dinh_luong_coi = numberValue(product.dinh_luong_coi);
      const rawNvl = Array.isArray(product.nvl)
        ? product.nvl
        : Array.isArray(product.chi_tiet)
          ? product.chi_tiet
          : [];
      const standardNvl = rawNvl
        .map(entry => parseStandardLine(entry))
        .filter((line): line is StandardLineRaw => Boolean(line))
        .map(line => fillStandardPercents(line, dinh_luong_coi, tong_trong_luong));
      if (standardNvl.length === 0) return null;
      return { ma_sp, ten_sp, ten_san_xuat, tong_trong_luong, dinh_luong_coi, standardNvl, rounds: [] };
    })
    .filter((product): product is ActualProduct => Boolean(product));
}

function parseSavedRoundLines(raw: unknown): ActualLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): ActualLine | null => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const ma_nvl = String(row.ma_nvl ?? '').trim();
      const ten_nvl = String(row.ten_nvl ?? '').trim();
      if (!ma_nvl && !ten_nvl) return null;
      const actualWeight = numberValue(row.trong_luong_thuc_te) ?? 0;
      return {
        ma_nvl,
        ten_nvl,
        phan_tram_thuc_te: null,
        trong_luong_thuc_te: actualWeight,
        trong_luong_thuc_te_input: String(actualWeight)
      };
    })
    .filter((line): line is ActualLine => Boolean(line));
}

/**
 * Phiếu thực tế đã lưu trước đây (kể cả bản ghi cũ) lưu round.tong_trong_luong = KL định mức của lần
 * trộn đó, KHÔNG PHẢI số nhân sự thực đo — vì vậy khi hiển thị lại KHÔNG dùng trực tiếp field này mà
 * luôn suy ra "Tổng KL cối thực tế" = tổng trọng_luong_thuc_te các dòng NVL đã lưu trong cối đó.
 */
function parseSavedRounds(rawProduct: unknown): ActualRound[] {
  if (!rawProduct || typeof rawProduct !== 'object') return [];
  const product = rawProduct as Record<string, unknown>;
  const rawRounds = Array.isArray(product.lan_tron) ? product.lan_tron : [];
  const source =
    rawRounds.length > 0
      ? rawRounds
      : Array.isArray(product.nvl) || Array.isArray(product.chi_tiet)
        ? [{ lan: 1, nvl: product.nvl ?? product.chi_tiet }]
        : [];
  return source.map((entry, index) => {
    const round = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const nvl = recalculateActualPercents(parseSavedRoundLines(round.nvl));
    const derivedTotal = nvl.reduce((sum, line) => sum + (line.trong_luong_thuc_te ?? 0), 0);
    return {
      lan: Math.max(1, Math.trunc(numberValue(round.lan) ?? index + 1)),
      tong_trong_luong: derivedTotal > 0 ? roundTo2(derivedTotal) : null,
      tong_trong_luong_input: derivedTotal > 0 ? String(roundTo2(derivedTotal)) : '',
      nvl
    };
  });
}

/** Gắn các cối trộn thực tế đã lưu vào đúng SP-block (khớp theo mã SP); cối tiêu chuẩn luôn giữ từ định mức. */
function attachSavedRounds(standardProducts: ActualProduct[], savedChiTiet: unknown): ActualProduct[] {
  if (!Array.isArray(savedChiTiet)) return standardProducts;
  const savedList = savedChiTiet.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  const savedByKey = new Map<string, Record<string, unknown>>();
  for (const item of savedList) {
    const key = `${String(item.ma_sp ?? '').trim()}|${String(item.ten_sp ?? '').trim()}`.toLowerCase();
    savedByKey.set(key, item);
  }
  return standardProducts.map(product => {
    const key = `${product.ma_sp}|${product.ten_sp}`.toLowerCase();
    const matched =
      savedByKey.get(key) ||
      savedList.find(item => {
        const ma = String(item.ma_sp ?? '').trim();
        return Boolean(ma) && ma === product.ma_sp;
      }) ||
      null;
    if (!matched) return product;
    return { ...product, rounds: parseSavedRounds(matched) };
  });
}

function resolveCatalogProductName(catalog: ProductRow[], codeStr: string): string {
  if (!codeStr || !catalog.length) return '';
  const codes = codeStr.split(',').map(c => c.trim()).filter(Boolean);
  const names = codes
    .map(c => {
      const match = catalog.find(p => p.ma_sp === c || p.ma_amis === c);
      return match?.ten_san_xuat || match?.ten_sp || '';
    })
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return uniqueNames.join(' / ');
}

function normalizeSecondaryProducts(raw: unknown): ActualSecondaryProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ActualSecondaryProduct | null => {
      if (!item || typeof item !== 'object') return null;
      const product = item as Record<string, unknown>;
      const isSecondary =
        String(product.loai ?? '').trim() === 'nvl_phu' ||
        (Array.isArray(product.nvl_phu) && product.nvl_phu.length > 0);
      if (!isSecondary) return null;

      const rawLines = Array.isArray(product.nvl_phu) && product.nvl_phu.length > 0
        ? product.nvl_phu
        : Array.isArray(product.chi_tiet) && product.chi_tiet.length > 0
          ? product.chi_tiet
          : Array.isArray(product.nvl)
            ? product.nvl
            : [];

      const lines: SecondaryLine[] = rawLines
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const row = entry as Record<string, unknown>;
          const ma_nvl = String(row.ma_nvl ?? '').trim();
          const ten_nvl = String(row.ten_nvl ?? '').trim();
          if (!ma_nvl && !ten_nvl) return null;
          const kl = numberValue(row.khoi_luong ?? row.gia_tri ?? row.tong_khoi_luong);
          return {
            ma_nvl,
            ten_nvl,
            ten_nvl_san_xuat: String(row.ten_nvl_san_xuat ?? '').trim(),
            khoi_luong_dinh_muc: kl,
            trong_luong_thuc_te: kl,
            trong_luong_thuc_te_input: kl !== null ? String(kl) : ''
          };
        })
        .filter((l): l is SecondaryLine => Boolean(l));

      if (lines.length === 0) return null;
      return {
        ma_sp: String(product.ma_sp ?? '').trim(),
        ten_sp: String(product.ten_sp ?? '').trim(),
        lines
      };
    })
    .filter((p): p is ActualSecondaryProduct => Boolean(p));
}

function attachSavedSecondary(
  standardSecondary: ActualSecondaryProduct[],
  savedChiTiet: unknown
): ActualSecondaryProduct[] {
  if (!Array.isArray(savedChiTiet)) return standardSecondary;
  const savedList = savedChiTiet.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'
  );

  return standardSecondary.map(sec => {
    const matched = savedList.find(item => {
      const isSec = String(item.loai ?? '').trim() === 'nvl_phu' || Array.isArray(item.nvl_phu);
      return isSec && String(item.ma_sp ?? '').trim() === sec.ma_sp;
    });
    if (!matched) return sec;

    const savedLinesRaw = Array.isArray(matched.nvl_phu) && matched.nvl_phu.length > 0
      ? matched.nvl_phu
      : Array.isArray(matched.nvl) && matched.nvl.length > 0
        ? matched.nvl
        : Array.isArray(matched.chi_tiet)
          ? matched.chi_tiet
          : [];

    const savedLineMap = new Map<string, number | null>();
    for (const s of savedLinesRaw) {
      if (!s || typeof s !== 'object') continue;
      const row = s as Record<string, unknown>;
      const k = lineKey(String(row.ma_nvl ?? ''), String(row.ten_nvl ?? ''));
      const val = numberValue(row.trong_luong_thuc_te);
      if (val !== null) savedLineMap.set(k, val);
    }

    const updatedLines = sec.lines.map(line => {
      const k = lineKey(line.ma_nvl, line.ten_nvl);
      if (savedLineMap.has(k)) {
        const savedVal = savedLineMap.get(k)!;
        return {
          ...line,
          trong_luong_thuc_te: savedVal,
          trong_luong_thuc_te_input: String(savedVal)
        };
      }
      return line;
    });

    return { ...sec, lines: updatedLines };
  });
}

function normalizeActualRecords(raw: unknown): ActualRecord[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { records?: unknown }).records)
      ? ((raw as { records: unknown[] }).records)
      : [];
  return rows
    .map((item): ActualRecord | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      const dinh_muc_id = String(row.dinh_muc_id ?? '').trim();
      if (!id || !dinh_muc_id) return null;
      return {
        id,
        dinh_muc_id,
        ngay: String(row.ngay ?? '').slice(0, 10),
        ca: String(row.ca ?? '').trim(),
        chi_tiet: row.chi_tiet,
        ghi_chu: row.ghi_chu == null ? '' : String(row.ghi_chu)
      };
    })
    .filter((row): row is ActualRecord => Boolean(row));
}

function readStoredSelection() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; shift?: string; normId?: string };
    return {
      date: String(parsed.date ?? '').slice(0, 10),
      shift: String(parsed.shift ?? '').trim(),
      normId: String(parsed.normId ?? '').trim()
    };
  } catch {
    return null;
  }
}

function writeStoredSelection(date: string, shift: string, normId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ date, shift, normId }));
  } catch {
    /* ignore */
  }
}

export default function ActualMixingSheetTab() {
  const stored = readStoredSelection();
  const [date, setDate] = useState(stored?.date || new Date().toISOString().slice(0, 10));
  const [norms, setNorms] = useState<NormRecord[]>([]);
  const [actuals, setActuals] = useState<ActualRecord[]>([]);
  const [selectedNormId, setSelectedNormId] = useState(stored?.normId || '');
  const [catalogProducts, setCatalogProducts] = useState<ProductRow[]>([]);
  const [products, setProducts] = useState<ActualProduct[]>([]);
  const [secondaryProducts, setSecondaryProducts] = useState<ActualSecondaryProduct[]>([]);
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
      fetch('/api/san-pham?format=table').then(res => res.json()).catch(() => [])
    ])
      .then(([normData, actualData, productData]) => {
        const rows = Array.isArray(normData.records) ? normData.records : [];
        setNorms(
          rows.map((row: Record<string, unknown>) => ({
            id: String(row.id ?? ''),
            ngay: String(row.ngay ?? '').slice(0, 10),
            ca: String(row.ca ?? '').trim(),
            ma_lenh_sx: String(row.ma_lenh_sx ?? ''),
            chi_tiet: row.chi_tiet
          }))
        );
        setActuals(normalizeActualRecords(actualData));
        setCatalogProducts(normalizeProducts(productData));
      })
      .catch(() => setError('Không thể tải dữ liệu phiếu trộn.'))
      .finally(() => setLoading(false));
  }, []);

  // Phiếu trộn định mức đi 1-1 theo lệnh SX (không còn theo ngày) — tìm theo mã lệnh SX,
  // không lọc theo ngày nữa (ngày ở đây là ngày thực hiện trộn thực tế, có thể khác ngày lập định mức).
  const matchingNorms = useMemo(() => {
    return [...norms].sort((left, right) => {
      const byOrder = left.ma_lenh_sx.localeCompare(right.ma_lenh_sx, 'vi');
      if (byOrder !== 0) return byOrder;
      return left.ca.localeCompare(right.ca, 'vi');
    });
  }, [norms]);

  const orderSelect2Options = useMemo(
    () => ({
      allowClear: true,
      minimumResultsForSearch: 0,
      placeholder: matchingNorms.length ? 'Gõ để tìm mã lệnh SX...' : 'Chưa có phiếu trộn định mức nào',
      language: {
        noResults: () => 'Không tìm thấy lệnh SX phù hợp.',
        searching: () => 'Đang tìm...'
      }
    }),
    [matchingNorms.length]
  );
  const orderSelect2RefreshKey = `${matchingNorms.map(row => row.id).join('|')}::${actuals
    .map(row => row.dinh_muc_id)
    .sort()
    .join('|')}`;

  const selectedNorm = useMemo(
    () => norms.find(row => row.id === selectedNormId) || null,
    [norms, selectedNormId]
  );

  useEffect(() => {
    if (!selectedNorm) {
      if (!selectedNormId) {
        setProducts([]);
        setSecondaryProducts([]);
        setNote('');
      }
      return;
    }
    const saved = actuals.find(row => String(row.dinh_muc_id) === String(selectedNorm.id));
    const standard = normalizeStandardProducts(selectedNorm.chi_tiet);
    setProducts(attachSavedRounds(standard, saved?.chi_tiet));
    const standardSec = normalizeSecondaryProducts(selectedNorm.chi_tiet);
    setSecondaryProducts(attachSavedSecondary(standardSec, saved?.chi_tiet));
    setNote(saved?.ghi_chu ?? '');
  }, [selectedNorm, selectedNormId, actuals]);

  useEffect(() => {
    writeStoredSelection(date, selectedNorm?.ca || '', selectedNormId);
  }, [date, selectedNorm?.ca, selectedNormId]);

  const addRound = (productIndex: number) => {
    setProducts(current =>
      current.map((product, pi) => {
        if (pi !== productIndex) return product;
        const nextLan = product.rounds.reduce((max, round) => Math.max(max, round.lan), 0) + 1;
        const nvl: ActualLine[] = product.standardNvl.map(std => ({
          ma_nvl: std.ma_nvl,
          ten_nvl: std.ten_nvl,
          phan_tram_thuc_te: null,
          trong_luong_thuc_te: null,
          trong_luong_thuc_te_input: ''
        }));
        return {
          ...product,
          rounds: [...product.rounds, { lan: nextLan, tong_trong_luong: null, tong_trong_luong_input: '', nvl }]
        };
      })
    );
    setMessage('');
    setError('');
  };

  const removeRound = (productIndex: number, roundIndex: number) => {
    setProducts(current =>
      current.map((product, pi) => {
        if (pi !== productIndex) return product;
        const rounds = product.rounds
          .filter((_, ri) => ri !== roundIndex)
          .map((round, index) => ({ ...round, lan: index + 1 }));
        return { ...product, rounds };
      })
    );
  };

  const changeRoundTotal = (productIndex: number, roundIndex: number, text: string) => {
    if (!ACTUAL_WEIGHT_INPUT_PATTERN.test(text)) return;
    if (text !== '' && !Number.isFinite(Number(text))) return;

    const product = products[productIndex];
    const round = product?.rounds[roundIndex];
    if (round && round.tong_trong_luong !== null) {
      const standardByKey = new Map<string, StandardLine>(product.standardNvl.map(s => [lineKey(s.ma_nvl, s.ten_nvl), s]));
      const hasManualEdit = round.nvl.some(line => {
        const std = standardByKey.get(lineKey(line.ma_nvl, line.ten_nvl));
        const expected = computeTlDm(std, round.tong_trong_luong);
        if (expected === null) return line.trong_luong_thuc_te !== null && line.trong_luong_thuc_te !== 0;
        return Math.abs((line.trong_luong_thuc_te ?? 0) - expected) > 0.005;
      });
      if (hasManualEdit && !window.confirm('Cối này có dòng NVL đã sửa tay khác định mức. Đổi Tổng KL cối sẽ ghi đè các dòng đó. Tiếp tục?')) {
        return;
      }
    }

    setError(current => (current === ACTUAL_WEIGHT_FORMAT_ERROR ? '' : current));
    const total = text === '' ? null : Number(text);
    setProducts(current =>
      current.map((p, pi) => {
        if (pi !== productIndex) return p;
        const standardByKey = new Map<string, StandardLine>(p.standardNvl.map(s => [lineKey(s.ma_nvl, s.ten_nvl), s]));
        return {
          ...p,
          rounds: p.rounds.map((r, ri) => {
            if (ri !== roundIndex) return r;
            const nvl = r.nvl.map(line => {
              const std = standardByKey.get(lineKey(line.ma_nvl, line.ten_nvl));
              const tlDm = computeTlDm(std, total);
              return {
                ...line,
                trong_luong_thuc_te: tlDm,
                trong_luong_thuc_te_input: tlDm === null ? '' : String(tlDm)
              };
            });
            return {
              ...r,
              tong_trong_luong: total,
              tong_trong_luong_input: text,
              nvl: recalculateActualPercents(nvl)
            };
          })
        };
      })
    );
  };

  const changeActualWeight = (productIndex: number, roundIndex: number, lineIndex: number, text: string) => {
    if (!ACTUAL_WEIGHT_INPUT_PATTERN.test(text)) return;
    if (text !== '' && !Number.isFinite(Number(text))) return;
    setError(current => (current === ACTUAL_WEIGHT_FORMAT_ERROR ? '' : current));
    const normalizedText = text === '' ? '0' : text;
    const actualWeight = Number(normalizedText);
    setProducts(current =>
      current.map((product, pi) =>
        pi !== productIndex
          ? product
          : {
              ...product,
              rounds: product.rounds.map((round, ri) =>
                ri !== roundIndex
                  ? round
                  : {
                      ...round,
                      nvl: recalculateActualPercents(
                        round.nvl.map((line, li) =>
                          li !== lineIndex
                            ? line
                            : { ...line, trong_luong_thuc_te: actualWeight, trong_luong_thuc_te_input: normalizedText }
                        )
                      )
                    }
              )
            }
      )
    );
  };

  const changeSecondaryActualWeight = (productIndex: number, lineIndex: number, text: string) => {
    if (!ACTUAL_WEIGHT_INPUT_PATTERN.test(text)) return;
    if (text !== '' && !Number.isFinite(Number(text))) return;
    setError(current => (current === ACTUAL_WEIGHT_FORMAT_ERROR ? '' : current));
    const actualWeight = text === '' ? null : Number(text);
    setSecondaryProducts(current =>
      current.map((prod, pi) =>
        pi !== productIndex
          ? prod
          : {
              ...prod,
              lines: prod.lines.map((line, li) =>
                li !== lineIndex
                  ? line
                  : {
                      ...line,
                      trong_luong_thuc_te: actualWeight,
                      trong_luong_thuc_te_input: text
                    }
              )
            }
      )
    );
  };

  const totalMixed = (product: ActualProduct) =>
    roundTo2(product.rounds.reduce((sum, round) => sum + (round.tong_trong_luong ?? 0), 0));

  const save = async () => {
    const norm = selectedNorm || norms.find(row => row.id === selectedNormId);
    if (!norm) return setError('Vui lòng chọn đúng dòng phiếu định mức.');
    if (!date) return setError('Vui lòng chọn ngày thực hiện trộn thực tế.');
    if (!norm.ca) return setError('Phiếu định mức thiếu ca — sửa phiếu định mức rồi lưu lại.');
    const hasFormulaLines = products.some(product => product.rounds.some(round => round.nvl.length > 0));
    const hasSecondaryLines = secondaryProducts.some(sec => sec.lines.length > 0);
    if (!hasFormulaLines && !hasSecondaryLines) {
      return setError('Phiếu không có dòng NVL để lưu.');
    }
    const overLimit = products.find(
      product => product.tong_trong_luong !== null && totalMixed(product) > product.tong_trong_luong + 0.0005
    );
    if (overLimit) {
      return setError(
        `SP ${overLimit.ma_sp || overLimit.ten_sp}: tổng KL các cối trộn thực tế (${formatNumber(totalMixed(overLimit))} kg) ` +
          `vượt Tổng SL sau hao hụt (${formatNumber(overLimit.tong_trong_luong)} kg).`
      );
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const existing = actuals.find(row => String(row.dinh_muc_id) === String(norm.id));
      const serializeLines = (lines: ActualLine[]) =>
        lines.map(line => ({
          ma_nvl: line.ma_nvl,
          ten_nvl: line.ten_nvl,
          phan_tram_thuc_te: line.phan_tram_thuc_te,
          trong_luong_thuc_te: line.trong_luong_thuc_te_input || null
        }));
      const payloadChiTiet: any[] = products.map(product => {
        const lan_tron = product.rounds.map(round => ({
          lan: round.lan,
          tong_trong_luong: round.tong_trong_luong,
          nvl: serializeLines(round.nvl)
        }));
        return {
          ma_sp: product.ma_sp,
          ten_sp: product.ten_sp,
          tong_trong_luong: product.tong_trong_luong,
          nvl: lan_tron[0]?.nvl ?? [],
          lan_tron
        };
      });

      for (const sec of secondaryProducts) {
        const nvl_phu = sec.lines.map(line => ({
          ma_nvl: line.ma_nvl,
          ten_nvl: line.ten_nvl,
          ten_nvl_san_xuat: line.ten_nvl_san_xuat,
          khoi_luong: line.khoi_luong_dinh_muc,
          gia_tri: line.khoi_luong_dinh_muc,
          tong_khoi_luong: line.khoi_luong_dinh_muc,
          don_vi: 'kg',
          trong_luong_thuc_te: line.trong_luong_thuc_te_input ? Number(line.trong_luong_thuc_te_input) : line.trong_luong_thuc_te
        }));
        payloadChiTiet.push({
          loai: 'nvl_phu',
          ma_sp: sec.ma_sp,
          ten_sp: sec.ten_sp,
          tong_trong_luong: null,
          nvl: nvl_phu,
          nvl_phu,
          lan_tron: []
        });
      }

      const res = await fetch('/api/phieu-tron-thuc-te', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existing?.id,
          ngay: date,
          ca: norm.ca,
          dinh_muc_id: norm.id,
          ma_lenh_sx: norm.ma_lenh_sx,
          ghi_chu: note,
          chi_tiet: payloadChiTiet
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu phiếu.');
      const record = normalizeActualRecords({ records: data.record ? [data.record] : [] })[0];
      if (!record) throw new Error('Máy chủ không trả về phiếu vừa lưu. Vui lòng thử lại.');

      setActuals(current => [
        ...current.filter(row => String(row.dinh_muc_id) !== String(norm.id)),
        record
      ]);
      const standard = normalizeStandardProducts(norm.chi_tiet);
      setProducts(attachSavedRounds(standard, record.chi_tiet));
      const standardSec = normalizeSecondaryProducts(norm.chi_tiet);
      setSecondaryProducts(attachSavedSecondary(standardSec, record.chi_tiet));
      setMessage(
        existing
          ? `Đã cập nhật đúng dòng ${norm.ma_lenh_sx || norm.id} · ca ${norm.ca}.`
          : `Đã lưu đúng dòng ${norm.ma_lenh_sx || norm.id} · ca ${norm.ca}.`
      );
    } catch (err: any) {
      setError(err.message || 'Không thể lưu phiếu.');
    } finally {
      setSaving(false);
    }
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
    if (!selectedNorm) return;
    const printProducts: Array<MixingNormProduct & { print_name?: string }> = [
      ...products.map(product => {
        const standardByKey = new Map<string, StandardLine>(product.standardNvl.map(s => [lineKey(s.ma_nvl, s.ten_nvl), s]));
        const catalogName = resolveCatalogProductName(catalogProducts, product.ma_sp);
        return {
          ma_sp: product.ma_sp,
          ten_sp: product.ten_sp,
          print_name: catalogName || undefined,
          tong_trong_luong: product.tong_trong_luong,
          dinh_luong_coi: product.dinh_luong_coi,
          ghi_chu: '',
          chi_tiet: product.standardNvl.map(std => ({
            ma_nvl: std.ma_nvl,
            ten_nvl: std.ten_nvl,
            ten_nvl_san_xuat: std.ten_nvl_san_xuat,
            gia_tri: std.ty_le_coi ?? std.gia_tri,
            don_vi: '%',
            khoi_luong: computeTlDm(std, product.dinh_luong_coi) ?? std.gia_tri,
            ty_le_coi: std.ty_le_coi,
            ty_le_tong: std.ty_le_tong,
            tong_khoi_luong: std.tong_khoi_luong
          })),
          lan_tron: product.rounds.map(round => ({
            lan: round.lan,
            tong_trong_luong: round.tong_trong_luong,
            nvl: round.nvl.map(line => {
              const std = standardByKey.get(lineKey(line.ma_nvl, line.ten_nvl));
              return {
                ma_nvl: line.ma_nvl,
                ten_nvl: line.ten_nvl,
                ten_nvl_san_xuat: std?.ten_nvl_san_xuat || '',
                gia_tri: std?.ty_le_coi ?? null,
                don_vi: 'kg',
                khoi_luong: computeTlDm(std, round.tong_trong_luong)
              };
            })
          }))
        };
      }),
      ...secondaryProducts.map(sec => {
        const catalogName = resolveCatalogProductName(catalogProducts, sec.ma_sp);
        const lines = sec.lines.map(line => ({
          ma_nvl: line.ma_nvl,
          ten_nvl: line.ten_nvl,
          ten_nvl_san_xuat: line.ten_nvl_san_xuat,
          gia_tri: line.khoi_luong_dinh_muc,
          don_vi: 'kg',
          khoi_luong: line.khoi_luong_dinh_muc,
          tong_khoi_luong: line.khoi_luong_dinh_muc,
          trong_luong_thuc_te: line.trong_luong_thuc_te
        }));
        return {
          loai: 'nvl_phu',
          ma_sp: sec.ma_sp,
          ten_sp: sec.ten_sp,
          print_name: catalogName || undefined,
          tong_trong_luong: null,
          ghi_chu: '',
          chi_tiet: lines,
          nvl_phu: lines
        };
      })
    ];

    setPrintDoc({
      maLenhSx: selectedNorm.ma_lenh_sx,
      ngay: date || selectedNorm.ngay,
      ca: selectedNorm.ca,
      isActual: true,
      intro: 'Tỷ lệ trộn định mức và kết quả trộn thực tế như sau',
      products: printProducts,
      actualValues: products.map(product =>
        product.rounds.flatMap(round => round.nvl).map(line => ({
          percent: line.phan_tram_thuc_te,
          weight: line.trong_luong_thuc_te
        }))
      ),
      actualRounds: products.map(product =>
        product.rounds.map(round => round.nvl.map(line => ({
          percent: line.phan_tram_thuc_te,
          weight: line.trong_luong_thuc_te
        })))
      )
    });
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm font-bold text-zinc-500">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Đang tải...
      </div>
    );
  }

  const savedForSelected = selectedNorm
    ? actuals.find(row => String(row.dinh_muc_id) === String(selectedNorm.id))
    : null;

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-black text-zinc-950">Phiếu trộn thực tế</h2>
        <p className="text-xs font-semibold text-zinc-500">
          Chọn đúng dòng phiếu định mức — ca lấy sẵn từ phiếu đó, không cần chọn ca riêng.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-black text-zinc-600">
          Ngày
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-black text-zinc-600">
          Lệnh SX (phiếu trộn định mức)
          <Select2
            value={selectedNormId}
            disabled={matchingNorms.length === 0}
            onValueChange={value => {
              setSelectedNormId(value);
              setError('');
              setMessage('');
            }}
            select2Options={orderSelect2Options}
            refreshKey={orderSelect2RefreshKey}
          >
            <option value="">
              {matchingNorms.length ? 'Gõ để tìm mã lệnh SX...' : 'Chưa có phiếu trộn định mức nào'}
            </option>
            {matchingNorms.map(row => {
              const hasActual = actuals.some(actual => String(actual.dinh_muc_id) === String(row.id));
              const label =
                (row.ma_lenh_sx || 'Không có mã lệnh') +
                (row.ca ? ` · Ca ${row.ca}` : '') +
                (hasActual ? ' · đã có thực tế' : '');
              return (
                <option key={row.id} value={row.id}>
                  {label}
                </option>
              );
            })}
          </Select2>
        </label>
      </div>
      {selectedNorm ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700">
          Đang mở dòng:{' '}
          <span className="font-black text-zinc-950">{selectedNorm.ma_lenh_sx || selectedNorm.id}</span>
          {' · '}Ngày trộn thực tế <span className="font-mono font-black">{date}</span>
          {' · '}Ca <span className="font-black">{selectedNorm.ca || '—'}</span>
          {savedForSelected ? (
            <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
              Đã có phiếu thực tế
            </span>
          ) : null}
        </div>
      ) : null}
      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"
        >
          <XCircle className="h-5 w-5 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </p>
      )}
      {selectedNormId &&
        products.map((product, pi) => {
          const mixed = totalMixed(product);
          const overLimit = product.tong_trong_luong !== null && mixed > product.tong_trong_luong + 0.0005;
          const catalogName = resolveCatalogProductName(catalogProducts, product.ma_sp);
          return (
            <div key={`${product.ma_sp}-${pi}`} className="overflow-hidden rounded-xl border border-zinc-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-100 px-3 py-2">
                <div>
                  <div className="text-sm font-black text-zinc-900">
                    Sản phẩm: {product.ma_sp}
                    {catalogName ? ` · ${catalogName}` : ''}
                  </div>
                  {product.ten_sp ? (
                    <div className="mt-0.5 text-xs font-bold text-blue-700">
                      {formatWorkerName(product.ten_sp)}
                    </div>
                  ) : null}
                </div>
                <span className={`text-xs font-bold ${overLimit ? 'text-rose-600' : 'text-zinc-500'}`}>
                  Đã trộn: {formatNumber(mixed)} / Tổng SL sau hao hụt: {formatNumber(product.tong_trong_luong)} kg
                </span>
              </div>

              <div className="border-b border-zinc-200 bg-red-50/40 p-2">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#ef1b2d]">
                      Cối trộn tiêu chuẩn (định mức — không sửa)
                    </span>
                    {product.dinh_luong_coi !== null && product.dinh_luong_coi !== undefined ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-700 shadow-sm">
                        Định lượng 1 cối:
                        <strong className="font-black text-[#ef1b2d]">
                          {formatNumber(product.dinh_luong_coi)} kg
                        </strong>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] table-fixed text-left text-[11px]">
                    <thead className="bg-zinc-950 text-white">
                      <tr>
                        <th className="px-2 py-1.5">Mã NVL</th>
                        <th className="px-2 py-1.5">Tên NVL</th>
                        <th className="px-2 py-1.5">Tên NVL SX</th>
                        <th className="px-2 py-1.5 text-center">Giá trị (kg)</th>
                        <th className="px-2 py-1.5 text-center">% Cối trộn</th>
                        <th className="px-2 py-1.5 text-center">% Tổng SL</th>
                        <th className="px-2 py-1.5 text-center">Tổng trọng lượng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {product.standardNvl.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-2 py-3 text-center font-semibold text-zinc-400">
                            Chưa có NVL định mức.
                          </td>
                        </tr>
                      ) : (
                        product.standardNvl.map((line, li) => (
                          <tr key={`${line.ma_nvl}-${li}`}>
                            <td className="px-2 py-1.5 font-mono font-bold">{line.ma_nvl}</td>
                            <td className="break-words px-2 py-1.5">{line.ten_nvl}</td>
                            <td className="break-words px-2 py-1.5">{line.ten_nvl_san_xuat}</td>
                            <td className="px-2 py-1.5 text-center font-mono">{formatNumber(line.gia_tri)}</td>
                            <td className="px-2 py-1.5 text-center font-mono">
                              {line.ty_le_coi === null ? '—' : `${formatActualPercent(line.ty_le_coi)}%`}
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono">
                              {line.ty_le_tong === null ? '—' : `${formatActualPercent(line.ty_le_tong)}%`}
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono font-black text-[#ef1b2d]">
                              {formatNumber(line.tong_khoi_luong)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => addRound(pi)}
                  className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-white px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm cối trộn
                </button>
              </div>

              <div className="overflow-x-auto p-2">
                {product.rounds.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-[11px] font-bold text-zinc-500">
                    Chưa có cối trộn thực tế nào — bấm "Thêm cối trộn" ở trên.
                  </p>
                ) : (
                  <div className="flex min-w-max items-start gap-2">
                    {product.rounds.map((round, ri) => (
                      <div
                        key={`${product.ma_sp}-round-${round.lan}-${ri}`}
                        className="w-[640px] shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white"
                      >
                        <div className="flex items-center justify-between gap-2 bg-red-50 px-2 py-1.5">
                          <span className="text-[11px] font-black uppercase text-[#ef1b2d]">
                            Lần trộn thứ {round.lan}
                          </span>
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600">
                            Tổng KL cối thực tế
                            <input
                              type="text"
                              inputMode="decimal"
                              value={round.tong_trong_luong_input}
                              onChange={e => changeRoundTotal(pi, ri, e.target.value)}
                              onFocus={e => e.currentTarget.select()}
                              className={`${fieldClass} h-8 w-24 px-2 text-center text-[11px]`}
                              placeholder="0.00"
                              aria-label={`Tổng KL cối thực tế lần trộn thứ ${round.lan}`}
                            />
                            kg
                          </label>
                          <button
                            type="button"
                            onClick={() => removeRound(pi, ri)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                            title="Xoá cối trộn này"
                            aria-label={`Xoá lần trộn thứ ${round.lan}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <table className="w-full table-fixed text-left text-[10px]">
                          <colgroup>
                            <col className="w-[95px]" />
                            <col />
                            <col className="w-[80px]" />
                            <col className="w-[90px]" />
                            <col className="w-[70px]" />
                          </colgroup>
                          <thead className="bg-zinc-950 text-white">
                            <tr>
                              <th className="px-2 py-1.5">Mã NVL</th>
                              <th className="px-2 py-1.5">Tên NVL</th>
                              <th className="px-1 py-1.5 text-center" title="Trọng lượng định mức quy theo tổng KL cối thực tế">
                                TL ĐM
                              </th>
                              <th className="px-1 py-1.5 text-center">Trọng lượng thực tế</th>
                              <th className="px-1 py-1.5 text-center" title="Phần trăm thực tế">
                                % TT
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {round.nvl.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-2 py-3 text-center font-semibold text-zinc-400">
                                  Cối này chưa có NVL định mức.
                                </td>
                              </tr>
                            ) : (
                              round.nvl.map((line, li) => {
                                const std = product.standardNvl.find(
                                  s => lineKey(s.ma_nvl, s.ten_nvl) === lineKey(line.ma_nvl, line.ten_nvl)
                                );
                                const tlDm = computeTlDm(std, round.tong_trong_luong);
                                return (
                                  <tr key={`${line.ma_nvl}-${li}`}>
                                    <td className="px-2 py-1.5 font-mono font-bold">{line.ma_nvl}</td>
                                    <td className="break-words px-2 py-1.5">{line.ten_nvl}</td>
                                    <td className="px-1 py-1.5 text-center font-mono">{formatNumber(tlDm)}</td>
                                    <td className="px-1 py-1">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={line.trong_luong_thuc_te_input}
                                        onChange={e => changeActualWeight(pi, ri, li, e.target.value)}
                                        onFocus={e => e.currentTarget.select()}
                                        className={`${fieldClass} h-8 w-full px-1 text-center text-[10px]`}
                                        placeholder="0.00"
                                        aria-label={`Trọng lượng thực tế lần trộn thứ ${round.lan} ${line.ma_nvl || line.ten_nvl}`}
                                      />
                                    </td>
                                    <td className="px-1 py-1.5 text-center font-mono font-black text-[#ef1b2d]">
                                      {formatActualPercent(line.phan_tram_thuc_te)}%
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      {selectedNormId && secondaryProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#ef1b2d]">
              Nguyên liệu phụ
            </h3>
          </div>
          {secondaryProducts.map((secProd, pi) => {
            const catalogName = resolveCatalogProductName(catalogProducts, secProd.ma_sp);
            return (
              <div key={`sec-${secProd.ma_sp}-${pi}`} className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="bg-zinc-100 px-3 py-2">
                  <div className="text-sm font-black text-zinc-900">
                    Sản phẩm: {secProd.ma_sp}
                    {catalogName ? ` · ${catalogName}` : ''}
                  </div>
                  {secProd.ten_sp ? (
                    <div className="mt-0.5 text-xs font-bold text-blue-700">
                      {formatWorkerName(secProd.ten_sp)}
                    </div>
                  ) : null}
                </div>
                <div className="overflow-x-auto p-2">
                  <table className="w-full min-w-[640px] table-fixed text-left text-[11px]">
                    <thead className="bg-zinc-950 text-white">
                      <tr>
                        <th className="w-10 px-2 py-1.5 text-center">STT</th>
                        <th className="w-28 px-2 py-1.5">Mã NVL</th>
                        <th className="px-2 py-1.5">Tên NVL</th>
                        <th className="px-2 py-1.5">Tên NVL SX</th>
                        <th className="w-32 px-2 py-1.5 text-center">Định mức (kg)</th>
                        <th className="w-36 px-2 py-1.5 text-center">Trọng lượng thực tế (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {secProd.lines.map((line, li) => (
                        <tr key={`${line.ma_nvl}-${li}`}>
                          <td className="px-2 py-1.5 text-center font-bold text-zinc-500">{li + 1}</td>
                          <td className="px-2 py-1.5 font-mono font-bold">{line.ma_nvl}</td>
                          <td className="break-words px-2 py-1.5">{line.ten_nvl}</td>
                          <td className="break-words px-2 py-1.5">{line.ten_nvl_san_xuat || '—'}</td>
                          <td className="px-2 py-1.5 text-center font-mono font-bold">
                            {formatNumber(line.khoi_luong_dinh_muc)}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.trong_luong_thuc_te_input}
                              onChange={e => changeSecondaryActualWeight(pi, li, e.target.value)}
                              onFocus={e => e.currentTarget.select()}
                              className={`${fieldClass} h-8 w-full px-2 text-center text-[11px]`}
                              placeholder="0.00"
                              aria-label={`Trọng lượng thực tế ${line.ma_nvl || line.ten_nvl}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-zinc-200 bg-zinc-50 font-bold">
                      <tr>
                        <td colSpan={4} className="px-2 py-1.5 text-right text-zinc-600">
                          Tổng cộng NVL phụ:
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono font-black text-zinc-900">
                          {formatNumber(
                            secProd.lines.reduce((sum, l) => sum + (l.khoi_luong_dinh_muc ?? 0), 0)
                          )}{' '}
                          kg
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono font-black text-[#ef1b2d]">
                          {formatNumber(
                            secProd.lines.reduce((sum, l) => sum + (l.trong_luong_thuc_te ?? 0), 0)
                          )}{' '}
                          kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedNormId && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="grid flex-1 gap-1 text-xs font-black text-zinc-600">
            Ghi chú
            <input value={note} onChange={e => setNote(e.target.value)} className={fieldClass} />
          </label>
          <button
            type="button"
            onClick={print}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-800"
          >
            <Printer className="h-4 w-4" />
            In phiếu
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Đang lưu...' : 'Lưu đúng dòng này'}
          </button>
        </div>
      )}
      {printDoc ? <MixingNormRatioPrintBatch docs={[printDoc]} /> : null}
    </section>
  );
}
