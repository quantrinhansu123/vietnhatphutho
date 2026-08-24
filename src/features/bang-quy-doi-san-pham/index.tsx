import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { useTabAccess } from '../../app/useTabAccess';
import { showAppToast } from '../../lib/appToast';
import { formatNumber } from '../../utils';
import { buildProductIdentityKey } from '../san-pham/types';
import {
  downloadProductConversionCsvTemplate, parseProductConversionCsv
} from '../../utils/productConversionCsv';
import {
  downloadProductConversionExcelTemplate, parseProductConversionExcel
} from '../../utils/productConversionExcel';
import {
  EMPTY_CONVERSION_INPUT, type ProductConversion, type ProductConversionInput, type ProductOption
} from './types';

const fieldClass = 'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10';

function normalizeProducts(data: unknown): ProductOption[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
    ? (data as { products: unknown[] }).products : [];
  return rows.map((item): ProductOption | null => {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    if (!id) return null;
    return { id, code: String(row.ma_sp ?? '').trim(), amisCode: String(row.ma_amis ?? '').trim(), name: String(row.ten_sp ?? '').trim(), productionName: String(row.ten_san_xuat ?? '').trim(), unit: String(row.don_vi ?? '').trim() };
  }).filter((item): item is ProductOption => Boolean(item));
}

function toInput(row: ProductConversion): ProductConversionInput {
  const text = (value: number | null) => value === null ? '' : String(value);
  return { productId: row.sanPhamId, sheetWidthM: text(row.khoTamRongM), sheetLengthM: text(row.khoTamDaiM), rollWidthM: text(row.khoCuonRongM), rollLengthM: text(row.khoCuonDaiM), areaM2: text(row.dienTichM2), kgPerLinearM: text(row.trongLuongKgMDai), kgPerM2: text(row.trongLuongKgM2), kgPerSheet: text(row.trongLuongKgTam), kgPerRoll: text(row.trongLuongKgCuon) };
}

function payload(input: ProductConversionInput) {
  return { productId: input.productId, sheetWidthM: input.sheetWidthM, sheetLengthM: input.sheetLengthM, rollWidthM: input.rollWidthM, rollLengthM: input.rollLengthM, areaM2: input.areaM2, kgPerLinearM: input.kgPerLinearM, kgPerM2: input.kgPerM2, kgPerSheet: input.kgPerSheet, kgPerRoll: input.kgPerRoll };
}

function ConversionModal({ row, products, saving, onClose, onSave }: { row: ProductConversion | null; products: ProductOption[]; saving: boolean; onClose: () => void; onSave: (value: ProductConversionInput) => void }) {
  const [form, setForm] = useState<ProductConversionInput>(() => row ? toInput(row) : { ...EMPTY_CONVERSION_INPUT });
  const [error, setError] = useState('');
  const numberFields: Array<[keyof ProductConversionInput, string]> = [
    ['sheetWidthM', 'Khổ tấm rộng (m)'], ['sheetLengthM', 'Khổ tấm dài (m/tấm)'],
    ['rollWidthM', 'Khổ cuộn rộng (m)'], ['rollLengthM', 'Khổ cuộn dài (m)'],
    ['areaM2', 'Diện tích (m²)'], ['kgPerLinearM', 'Trọng lượng (kg/m dài)'],
    ['kgPerM2', 'Trọng lượng (kg/m²)'], ['kgPerSheet', 'Trọng lượng (kg/tấm)'],
    ['kgPerRoll', 'Trọng lượng (kg/Cuộn)']
  ];
  const submit = () => {
    if (!form.productId) return setError('Vui lòng chọn sản phẩm.');
    for (const [key, label] of numberFields) {
      const raw = form[key].trim(); if (raw && (!Number.isFinite(Number(raw.replace(',', '.'))) || Number(raw.replace(',', '.')) <= 0)) return setError(`${label} phải lớn hơn 0.`);
    }
    onSave(form);
  };
  return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-3">
    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-black text-zinc-950">{row ? 'Sửa quy đổi' : 'Thêm quy đổi'}</h2><button onClick={onClose}><X /></button></div>
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        <label className="md:col-span-2"><span className="mb-1 block text-xs font-black uppercase text-zinc-500">Sản phẩm *</span>
          <SearchableSelect value={form.productId} onChange={productId => setForm(prev => ({ ...prev, productId }))} options={products} placeholder="Gõ mã hoặc tên sản phẩm" inputClassName={`${fieldClass} disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500`} disabled={Boolean(row)} getValue={item => (item as ProductOption).id} getLabel={item => { const p = item as ProductOption; return `${p.code || p.amisCode} · ${p.name}`; }} getSearchText={item => { const p = item as ProductOption; return `${p.code} ${p.amisCode} ${p.name}`; }} />
          {row && <span className="mt-1 block text-xs font-semibold text-zinc-500">Không thể thay đổi sản phẩm khi sửa dòng quy đổi.</span>}
        </label>
        {numberFields.map(([key, label]) => <label key={key}><span className="mb-1 block text-xs font-black uppercase text-zinc-500">{label}</span><input type="number" min="0" step="any" value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} className={fieldClass} /></label>)}
        {error && <p className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t bg-zinc-50 px-5 py-4"><button onClick={onClose} className="h-10 rounded-lg border px-4 text-sm font-bold">Hủy</button><button onClick={submit} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu</button></div>
    </div>
  </div>;
}

export function ProductConversionsPanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('product-conversions');
  const [rows, setRows] = useState<ProductConversion[]>([]), [products, setProducts] = useState<ProductOption[]>([]);
  const [key, setKey] = useState(''), [debouncedKey, setDebouncedKey] = useState('');
  const [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number; created: number; updated: number; failed: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false), [editing, setEditing] = useState<ProductConversion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{errors: Array<{rowNumber: number; amisCode: string; productName: string; error: string}>; validRows: Array<{rowNumber: number; amisCode: string; productName: string; productionName: string; sanPhamId: string; fields: Record<string, unknown>}>} | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedKey(key.trim()), 300); return () => window.clearTimeout(timer); }, [key]);
  const loadAll = async (searchKey = debouncedKey) => { const all: ProductConversion[] = []; for (let current = 1; ; current += 1) { const res = await fetch(`/api/bang-quy-doi-san-pham?key=${encodeURIComponent(searchKey)}&page=${current}&pageSize=200`); const data = await res.json(); if (!res.ok) throw new Error(data.error); all.push(...(data.items || [])); if (all.length >= Number(data.total || 0)) return all; } };
  const load = async () => { setLoading(true); setError(''); try { const items = await loadAll(''); setRows(items); setTotal(items.length); } catch { const errorMessage = 'Không thể tải bảng quy đổi. Vui lòng kiểm tra kết nối và thử lại.'; setError(errorMessage); showAppToast(errorMessage, 'error'); setRows([]); setTotal(0); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  useEffect(() => { fetch('/api/san-pham?format=table').then(res => res.json()).then(data => setProducts(normalizeProducts(data))).catch(() => setProducts([])); }, []);
  const filteredRows = useMemo(() => {
    const normalized = debouncedKey.toLocaleLowerCase('vi');
    if (!normalized) return rows;
    return rows.filter(row => `${row.maSp} ${row.maAmis} ${row.tenSp} ${row.donViTinh}`.toLocaleLowerCase('vi').includes(normalized));
  }, [rows, debouncedKey]);
  const save = async (form: ProductConversionInput) => { setSaving(true); setError(''); try { const res = await fetch(editing ? `/api/bang-quy-doi-san-pham/${editing.id}` : '/api/bang-quy-doi-san-pham', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(form)) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Không lưu được dòng quy đổi.'); setModalOpen(false); const successMessage = editing ? 'Đã cập nhật dòng quy đổi.' : 'Đã thêm dòng quy đổi.'; setMessage(successMessage); showAppToast(successMessage); await load(); } catch (e: any) { const errorMessage = e.message || 'Không lưu được dòng quy đổi.'; setError(errorMessage); showAppToast(errorMessage, 'error'); } finally { setSaving(false); } };
  const remove = async (row: ProductConversion) => { if (!window.confirm(`Xóa quy đổi ${row.maSp || row.maAmis} · ${row.donViTinh}?`)) return; const res = await fetch(`/api/bang-quy-doi-san-pham/${row.id}`, { method: 'DELETE' }); const data = await res.json(); if (!res.ok) return setError(data.error || 'Không xóa được.'); setMessage('Đã xóa dòng quy đổi.'); await load(); };
  const parseAndValidateRows = async (rows: Array<{amisCode: string; productName: string; productionName: string; sheetWidthM: string; sheetLengthM: string; rollWidthM: string; rollLengthM: string; areaM2: string; kgPerLinearM: string; kgPerM2: string; kgPerSheet: string; kgPerRoll: string; rowNumber: number}>) => {
    const errors: Array<{rowNumber: number; amisCode: string; productName: string; error: string}> = [];
    const validRows: Array<{rowNumber: number; amisCode: string; productName: string; productionName: string; sanPhamId: string; fields: Record<string, unknown>}> = [];
    const productsByIdentity = new Map<string, ProductOption>();
    const productsByAmisName = new Map<string, ProductOption>();
    const productsByAmis = new Map<string, ProductOption>();

    products.forEach(product => {
      const identityKey = buildProductIdentityKey(product.amisCode, product.name, product.productionName);
      if (identityKey) productsByIdentity.set(identityKey, product);
      const amisNameKey = `${product.amisCode.trim().toLowerCase()}|${product.name.trim().toLowerCase()}`;
      if (amisNameKey) productsByAmisName.set(amisNameKey, product);
      if (product.amisCode) productsByAmis.set(product.amisCode.trim().toLowerCase(), product);
    });

    for (const row of rows) {
      const amis = row.amisCode.trim();
      const name = row.productName.trim();
      const production = row.productionName.trim();

      if (!amis) {
        errors.push({ rowNumber: row.rowNumber, amisCode: amis, productName: name, error: 'Mã amis bắt buộc' });
        continue;
      }

      let product: ProductOption | undefined;
      if (amis && name && production) {
        const identityKey = buildProductIdentityKey(amis, name, production);
        if (identityKey) product = productsByIdentity.get(identityKey);
      }
      if (!product && amis && name) {
        const amisNameKey = `${amis.toLowerCase()}|${name.toLowerCase()}`;
        product = productsByAmisName.get(amisNameKey);
      }
      if (!product && amis) {
        product = productsByAmis.get(amis.toLowerCase());
      }

      if (!product) {
        errors.push({ rowNumber: row.rowNumber, amisCode: amis, productName: name, error: 'Không tìm thấy sản phẩm' });
        continue;
      }

      const validateNum = (val: string) => {
        if (!val.trim()) return null;
        const num = Number(val.replace(',', '.'));
        return Number.isFinite(num) && num > 0 ? num : 'invalid';
      };

      const fields: Record<string, unknown> = { san_pham_id: product.id };
      const fieldMaps = [
        ['sheetWidthM', 'kho_tam_rong_m'],
        ['sheetLengthM', 'kho_tam_dai_m'],
        ['rollWidthM', 'kho_cuon_rong_m'],
        ['rollLengthM', 'kho_cuon_dai_m'],
        ['areaM2', 'dien_tich_m2'],
        ['kgPerLinearM', 'trong_luong_kg_m_dai'],
        ['kgPerM2', 'trong_luong_kg_m2'],
        ['kgPerSheet', 'trong_luong_kg_tam'],
        ['kgPerRoll', 'trong_luong_kg_cuon']
      ] as const;

      let hasError = false;
      for (const [csvField, dbField] of fieldMaps) {
        const val = validateNum(row[csvField as keyof typeof row] as string);
        if (val === 'invalid') {
          errors.push({ rowNumber: row.rowNumber, amisCode: amis, productName: name, error: `${dbField} phải là số lớn hơn 0 hoặc để trống` });
          hasError = true;
          break;
        }
        fields[dbField] = val;
      }

      if (!hasError) {
        validRows.push({ rowNumber: row.rowNumber, amisCode: amis, productName: name, productionName: production, sanPhamId: product.id, fields });
      }
    }

    return { errors, validRows };
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const imported = await parseProductConversionCsv(file);
      const { errors, validRows } = await parseAndValidateRows(imported);
      if (errors.length > 0 && validRows.length === 0) {
        setError(`${errors.length} dòng có lỗi, không thể import`);
        setPreviewData({ errors, validRows: [] });
        setPreviewOpen(true);
        setSaving(false);
        return;
      }
      if (errors.length > 0) {
        setPreviewData({ errors, validRows });
        setPreviewOpen(true);
        setSaving(false);
        return;
      }
      const jobs = validRows.map(row => ({ rowNumber: row.rowNumber, ...row.fields }));
      let created = 0, updated = 0, failed = 0, processed = 0;
      setImportProgress({ processed, total: validRows.length, created, updated, failed });
      for (let index = 0; index < jobs.length; index += 200) {
        const batch = jobs.slice(index, index + 200);
        const res = await fetch('/api/bang-quy-doi-san-pham/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: batch }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không import được dữ liệu.');
        processed += Number(data.processed) || batch.length;
        created += Number(data.created) || 0;
        updated += Number(data.updated) || 0;
        failed += Number(data.failed) || 0;
        setImportProgress({ processed, total: validRows.length, created, updated, failed });
      }
      setMessage(`CSV: ${validRows.length} dòng · thêm ${created} · cập nhật ${updated} · lỗi/bỏ qua ${failed}.`);
      await load();
    } catch (e: any) { setError(e.message || 'Không nhập được CSV.'); }
    finally { setSaving(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const exportCsv = async () => {
    setExporting(true); setError(''); setMessage('');
    try {
      const res = await fetch(`/api/export-bang-quy-doi-san-pham?key=${encodeURIComponent(debouncedKey)}`);
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Không xuất được CSV.'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `bang-quy-doi-san-pham-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
      setMessage(`Đã xuất ${filteredRows.length} dòng${debouncedKey ? ' theo từ khóa đang tìm' : ''}.`);
    } catch (e: any) { setError(e.message || 'Không xuất được CSV.'); }
    finally { setExporting(false); }
  };
  const handleImportExcel = async (file?: File) => {
    if (!file) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const imported = await parseProductConversionExcel(file);
      const { errors, validRows } = await parseAndValidateRows(imported);
      if (errors.length > 0 && validRows.length === 0) {
        setError(`${errors.length} dòng có lỗi, không thể import`);
        setPreviewData({ errors, validRows: [] });
        setPreviewOpen(true);
        return;
      }
      if (errors.length > 0) {
        setPreviewData({ errors, validRows });
        setPreviewOpen(true);
        return;
      }
      const jobs = validRows.map(row => ({ rowNumber: row.rowNumber, ...row.fields }));
      let created = 0, updated = 0, failed = 0, processed = 0;
      setImportProgress({ processed, total: validRows.length, created, updated, failed });
      for (let index = 0; index < jobs.length; index += 10) {
        const batch = jobs.slice(index, index + 10);
        const res = await fetch('/api/bang-quy-doi-san-pham/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: batch }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không import được dữ liệu.');
        processed += Number(data.processed) || batch.length;
        created += Number(data.created) || 0;
        updated += Number(data.updated) || 0;
        failed += Number(data.failed) || 0;
        setImportProgress({ processed, total: validRows.length, created, updated, failed });
      }
      setMessage(`Excel: ${validRows.length} dòng · thêm ${created} · cập nhật ${updated} · lỗi/bỏ qua ${failed}.`);
      setPreviewOpen(false);
      await load();
    } catch (e: any) { setError(e.message || 'Không nhập được Excel.'); }
    finally { setSaving(false); if (excelFileRef.current) excelFileRef.current.value = ''; }
  };
  const fmt = (value: number | null) => value === null ? '—' : formatNumber(value, 3);
  return <div className="min-h-full bg-white font-sans [&_button]:cursor-pointer [&_tbody_tr]:cursor-pointer [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-emerald-50">
    <div className="border-b bg-white px-4 py-4 md:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><BackButton onClick={onBack} /><div><h1 className="text-xl font-black text-zinc-950">Bảng quy đổi sản phẩm</h1><p className="text-xs font-semibold text-zinc-500">Đơn vị, kích thước và trọng lượng theo danh mục sản phẩm</p></div></div><div className="flex flex-wrap gap-2"><button disabled={saving || exporting} onClick={downloadProductConversionCsvTemplate} className="h-10 rounded-lg border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"><Download className="mr-1 inline h-4 w-4" />Mẫu CSV</button><button disabled={saving || exporting} onClick={downloadProductConversionExcelTemplate} className="h-10 rounded-lg border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"><Download className="mr-1 inline h-4 w-4" />Mẫu Excel</button><button disabled={saving || exporting} onClick={() => void exportCsv()} className="h-10 rounded-lg border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">{exporting ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <Download className="mr-1 inline h-4 w-4" />}{exporting ? 'Đang xuất...' : 'Xuất CSV'}</button>{(canCreate || canEdit) && <><button disabled={saving || exporting} onClick={() => fileRef.current?.click()} className="h-10 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <FileUp className="mr-1 inline h-4 w-4" />}{saving ? 'Đang import...' : 'Nhập CSV'}</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e => void importCsv(e.target.files?.[0])} /><button disabled={saving || exporting} onClick={() => excelFileRef.current?.click()} className="h-10 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <FileUp className="mr-1 inline h-4 w-4" />}{saving ? 'Đang import...' : 'Nhập Excel'}</button><input ref={excelFileRef} hidden type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={e => void handleImportExcel(e.target.files?.[0])} /></>}{canCreate && <button disabled={saving || exporting} onClick={() => { setEditing(null); setModalOpen(true); }} className="h-10 rounded-lg bg-red-600 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="mr-1 inline h-4 w-4" />Thêm</button>}</div></div></div>
    <div className="p-4 md:p-6"><input value={key} onChange={e => setKey(e.target.value)} className={`${fieldClass} mb-3 max-w-xl`} placeholder="Tìm mã SP, mã AMIS, tên sản phẩm hoặc đơn vị..." />{importProgress && saving && <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3"><div className="mb-2 flex justify-between text-sm font-bold text-blue-800"><span>Đang xử lý CSV</span><span>{importProgress.processed}/{importProgress.total} dòng</span></div><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${importProgress.total ? Math.round(importProgress.processed / importProgress.total * 100) : 0}%` }} /></div><p className="mt-2 text-xs font-semibold text-blue-700">Thêm {importProgress.created} · Cập nhật {importProgress.updated} · Lỗi/bỏ qua {importProgress.failed}</p></div>}{message && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{message}</p>}{error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}
      <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-xl border"><table className="w-full table-fixed text-left text-[11px]"><colgroup><col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[16%]" />{Array.from({ length: 9 }).map((_, index) => <col key={index} className="w-[7%]" />)}<col className="w-[10%]" /></colgroup><thead className="sticky top-0 z-20 bg-zinc-950 text-white"><tr>{['Mã SP','Mã AMIS','Tên sản phẩm','Khổ tấm rộng\n(m rộng)','Khổ tấm dài\n(m dài / tấm)','Khổ cuộn rộng\n(m rộng)','Khổ cuộn dài\n(m dài)','Khổ diện tích\n(m2)','Trọng lượng\n(kg/1 m dài)','Trọng lượng\n(kg/m2)','Trọng lượng\n(kg/Tấm)','Trọng lượng\n(kg/Cuộn)'].map(h => <th key={h} className="break-words px-2 py-3 text-center font-black leading-tight">{h.split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}</th>)}<th className="sticky right-0 z-30 bg-zinc-950 px-2 py-3 text-center font-black">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan={13} className="py-10 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr> : filteredRows.length === 0 ? <tr><td colSpan={13} className="py-10 text-center font-bold text-zinc-400">Không có dữ liệu phù hợp.</td></tr> : filteredRows.map(row => <tr key={row.id} className="border-t"><td className="break-words px-2 py-2 font-black">{row.maSp || '—'}</td><td className="break-words px-2 py-2">{row.maAmis || '—'}</td><td className="break-words px-2 py-2 font-semibold">{row.tenSp || '—'}</td>{[row.khoTamRongM,row.khoTamDaiM,row.khoCuonRongM,row.khoCuonDaiM,row.dienTichM2,row.trongLuongKgMDai,row.trongLuongKgM2,row.trongLuongKgTam,row.trongLuongKgCuon].map((v,i) => <td key={i} className="px-2 py-2 text-right">{fmt(v)}</td>)}<td className="sticky right-0 bg-white px-2 py-2"><div className="flex justify-center gap-1">{canEdit && <button title="Sửa" onClick={() => { setEditing(row); setModalOpen(true); }} className="rounded border p-2 text-blue-600"><Pencil className="h-4 w-4" /></button>}{canDelete && <button title="Xóa" onClick={() => void remove(row)} className="rounded border p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div>
      <div className="mt-3 text-sm font-bold text-zinc-600">{filteredRows.length}{debouncedKey ? `/${total}` : ''} dòng</div>
    </div>{previewOpen && previewData && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-3"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-black text-zinc-950">Kết quả kiểm tra Import</h2><button onClick={() => setPreviewOpen(false)}><X /></button></div><div className="p-5">{previewData.errors.length > 0 && <div className="mb-4"><h3 className="mb-2 font-bold text-red-700">{previewData.errors.length} dòng có lỗi</h3><div className="max-h-64 overflow-y-auto rounded-lg bg-red-50 p-3 text-sm"><div className="space-y-1">{previewData.errors.map((err, idx) => <div key={idx} className="text-red-600">Dòng {err.rowNumber} ({err.amisCode}): {err.error}</div>)}</div></div></div>}{previewData.validRows.length > 0 && <div><h3 className="mb-2 font-bold text-emerald-700">{previewData.validRows.length} dòng sẵn sàng import</h3></div>}</div><div className="flex justify-end gap-2 border-t bg-zinc-50 px-5 py-4"><button onClick={() => setPreviewOpen(false)} className="h-10 rounded-lg border px-4 text-sm font-bold">Đóng</button>{previewData.validRows.length > 0 && <button onClick={async () => { const jobs = previewData.validRows.map(row => ({ rowNumber: row.rowNumber, ...row.fields })); let created = 0, updated = 0, failed = 0, processed = 0; setImportProgress({ processed, total: previewData.validRows.length, created, updated, failed }); for (let index = 0; index < jobs.length; index += 10) { const batch = jobs.slice(index, index + 10); const res = await fetch('/api/bang-quy-doi-san-pham/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: batch }) }); const data = await res.json(); if (!res.ok) { setError(data.error || 'Không import được dữ liệu.'); return; } processed += Number(data.processed) || batch.length; created += Number(data.created) || 0; updated += Number(data.updated) || 0; failed += Number(data.failed) || 0; setImportProgress({ processed, total: previewData.validRows.length, created, updated, failed }); } setMessage(`Excel: ${previewData.validRows.length} dòng · thêm ${created} · cập nhật ${updated} · lỗi/bỏ qua ${failed}.`); setPreviewOpen(false); if (excelFileRef.current) excelFileRef.current.value = ''; await load(); }} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Import</button>}</div></div></div>}{modalOpen && <ConversionModal row={editing} products={products} saving={saving} onClose={() => setModalOpen(false)} onSave={value => void save(value)} />}
  </div>;
}
