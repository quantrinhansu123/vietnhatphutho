import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeProducts, type ProductRow } from '../san-pham';

type InventoryLimit = {
  id: string;
  san_pham_id: string;
  ma_amis: string;
  ten_san_xuat: string;
  quy_cach: string;
  don_vi: 'Tấm' | 'Cuộn';
  ton_kho_toi_thieu: number;
  ton_kho_toi_da: number;
  thang: number;
  nam: number;
};

type DraftRow = Omit<InventoryLimit, 'id' | 'ton_kho_toi_thieu' | 'ton_kho_toi_da'> & {
  id?: string;
  ton_kho_toi_thieu: string;
  ton_kho_toi_da: string;
};

type FilterOption = { value: string; label: string };

const monthFilterOptions: FilterOption[] = [
  { value: 'all', label: 'Tất cả tháng' },
  ...Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: `Tháng ${String(index + 1).padStart(2, '0')}`
  }))
];

const fieldClass = 'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const currentDate = new Date();

function emptyRow(): DraftRow {
  return {
    san_pham_id: '', ma_amis: '', ten_san_xuat: '', quy_cach: '', don_vi: 'Tấm',
    ton_kho_toi_thieu: '', ton_kho_toi_da: '',
    thang: currentDate.getMonth() + 1, nam: currentDate.getFullYear()
  };
}

function toDraft(item: InventoryLimit): DraftRow {
  return { ...item, ton_kho_toi_thieu: String(item.ton_kho_toi_thieu), ton_kho_toi_da: String(item.ton_kho_toi_da) };
}

function normalizeItems(value: unknown, products: ProductRow[] = []): InventoryLimit[] {
  const raw = Array.isArray(value) ? value : (value && typeof value === 'object' && Array.isArray((value as any).items) ? (value as any).items : []);
  return raw.filter(item => item && typeof item === 'object').map(item => {
    const row = item as Record<string, unknown>;
    const san_pham_id = String(row.san_pham_id ?? row.product_id ?? '');
    const product = products.find(item => item.id === san_pham_id);
    return {
      id: String(row.id ?? ''), san_pham_id, ma_amis: String(row.ma_amis ?? product?.amisCode ?? ''), ten_san_xuat: String(row.ten_san_xuat ?? product?.productionName ?? ''),
      quy_cach: String(row.quy_cach ?? ''), don_vi: row.don_vi === 'Cuộn' ? 'Cuộn' : 'Tấm',
      ton_kho_toi_thieu: Number(row.ton_kho_toi_thieu ?? 0), ton_kho_toi_da: Number(row.ton_kho_toi_da ?? 0),
      thang: Number(row.thang ?? 0), nam: Number(row.nam ?? 0)
    } as InventoryLimit;
  });
}

export function InventoryLimitsPanel({ onBack }: { onBack: () => void }) {
  const [inventoryItems, setInventoryItems] = useState<InventoryLimit[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [limitsRes, productsRes] = await Promise.all([fetch('/api/ton-kho-toi-thieu-toi-da'), fetch('/api/san-pham?format=table')]);
      const limitsData = await limitsRes.json().catch(() => ({}));
      const productsData = await productsRes.json().catch(() => ({}));
      if (!limitsRes.ok) throw new Error(limitsData.error || 'Không thể tải danh sách tồn kho.');
      const normalizedProducts = normalizeProducts(productsData);
      setInventoryItems(normalizeItems(limitsData, normalizedProducts));
      setProducts(normalizedProducts);
    } catch (e: any) { setError(e.message || 'Không thể tải dữ liệu.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const productOptions = useMemo(() => products.filter(product => product.amisCode && product.amisCode !== '-'), [products]);
  const yearFilterOptions = useMemo<FilterOption[]>(() => [
    { value: 'all', label: 'Tất cả năm' },
    ...Array.from({ length: 8000 }, (_, index) => {
      const year = 2000 + index;
      return { value: String(year), label: String(year) };
    })
  ], []);
  const timeGroups = useMemo(() => {
    const groups = new Map<string, { thang: number; nam: number; rows: Array<{ row: DraftRow; index: number }> }>();
    rows.forEach((row, index) => {
      const key = `${row.thang}-${row.nam}`;
      const group = groups.get(key) || { thang: row.thang, nam: row.nam, rows: [] };
      group.rows.push({ row, index });
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [rows]);
  const openCreate = () => { setEditingId(null); setRows([emptyRow()]); setError(''); setMessage(''); setIsModalOpen(true); };
  const openEdit = (item: InventoryLimit) => { setEditingId(item.id); setRows([toDraft(item)]); setError(''); setMessage(''); setIsModalOpen(true); };
  const updateRow = (index: number, patch: Partial<DraftRow>) => setRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  const selectProduct = (index: number, productId: string) => {
    const product = productOptions.find(item => item.id === productId);
    updateRow(index, { san_pham_id: productId, ma_amis: product?.amisCode || '', ten_san_xuat: product?.productionName || '' });
  };
  const addTimeGroup = () => {
    const used = new Set(rows.map(row => `${row.thang}-${row.nam}`));
    let month = currentDate.getMonth() + 1;
    let year = currentDate.getFullYear();
    while (used.has(`${month}-${year}`)) { month += 1; if (month > 12) { month = 1; year += 1; } }
    setRows(prev => [...prev, { ...emptyRow(), thang: month, nam: year }]);
  };
  const addGroupRow = (thang: number, nam: number) => setRows(prev => [...prev, { ...emptyRow(), thang, nam }]);
  const removeTimeGroup = (thang: number, nam: number) => setRows(prev => {
    const next = prev.filter(row => row.thang !== thang || row.nam !== nam);
    return next.length ? next : [emptyRow()];
  });

  const validate = () => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.san_pham_id || !row.ma_amis) return 'Vui lòng chọn Mã AMIS cho tất cả dòng.';
      const min = Number(row.ton_kho_toi_thieu); const max = Number(row.ton_kho_toi_da);
      if (!Number.isInteger(min) || min < 0 || !Number.isInteger(max) || max < 0) return `Tồn kho của mã ${row.ma_amis} phải là số nguyên không âm.`;
      if (min > max) return `Tồn kho tối thiểu không được lớn hơn tối đa của mã ${row.ma_amis}.`;
      if (!Number.isInteger(row.thang) || row.thang < 1 || row.thang > 12 || !Number.isInteger(row.nam) || row.nam < 2000 || row.nam > 9999) return `Tháng/năm của mã ${row.ma_amis} không hợp lệ.`;
      const key = `${row.san_pham_id}|${row.thang}|${row.nam}`;
      if (seen.has(key) || inventoryItems.some(item => item.id !== editingId && `${item.san_pham_id}|${item.thang}|${item.nam}` === key)) return `Sản phẩm ${row.ma_amis} đã tồn tại trong tháng ${row.thang}/${row.nam}.`;
      seen.add(key);
    }
    return '';
  };

  const save = async () => {
    const validationError = validate(); if (validationError) { setError(validationError); return; }
    setSaving(true); setError('');
    const payload = rows.map(row => ({
      san_pham_id: row.san_pham_id,
      quy_cach: row.quy_cach,
      don_vi: row.don_vi,
      ton_kho_toi_thieu: Number(row.ton_kho_toi_thieu),
      ton_kho_toi_da: Number(row.ton_kho_toi_da),
      thang: row.thang,
      nam: row.nam
    }));
    try {
      const response = await fetch(editingId ? `/api/ton-kho-toi-thieu-toi-da/${editingId}` : '/api/ton-kho-toi-thieu-toi-da', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingId ? payload[0] : { items: payload }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không thể lưu dữ liệu.');
      setIsModalOpen(false); setMessage(editingId ? 'Đã cập nhật tồn kho.' : 'Đã lưu dữ liệu tồn kho.'); await load();
    } catch (e: any) { setError(e.message || 'Không thể lưu dữ liệu.'); }
    finally { setSaving(false); }
  };

  const remove = async (item: InventoryLimit) => {
    if (!window.confirm(`Xóa tồn kho của mã ${item.ma_amis} tháng ${item.thang}/${item.nam}?`)) return;
    const response = await fetch(`/api/ton-kho-toi-thieu-toi-da/${item.id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || 'Không thể xóa dữ liệu.'); else { setMessage('Đã xóa dữ liệu tồn kho.'); await load(); }
  };
  const filteredItems = inventoryItems.filter(item => {
    const query = searchText.trim().toLocaleLowerCase('vi');
    const matchesSearch = !query || `${item.ma_amis} ${item.ten_san_xuat} ${item.quy_cach} ${item.don_vi}`.toLocaleLowerCase('vi').includes(query);
    const matchesMonth = selectedMonth === 'all' || String(item.thang) === selectedMonth;
    const matchesYear = selectedYear === 'all' || String(item.nam) === selectedYear;
    return matchesSearch && matchesMonth && matchesYear;
  });

  return <div className="flex h-full min-h-0 flex-col bg-zinc-50">
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
      <div><button type="button" onClick={onBack} className="mb-1 text-xs font-bold text-zinc-500 hover:text-zinc-900">← Quay lại</button><h2 className="text-lg font-black text-zinc-950">Tồn kho tối thiểu - Tồn kho tối đa</h2></div>
      <button type="button" onClick={openCreate} className="flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-extrabold text-white"><Plus className="h-4 w-4" /> Thêm mới thời gian</button>
    </div>
    {(error || message) && <div className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs font-bold ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
    <div className="min-h-0 flex-1 overflow-auto p-4"><div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 lg:flex-nowrap"><input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Tìm mã AMIS, tên sản xuất, quy cách..." className={`${fieldClass} min-w-0 lg:flex-1`} /><div className="w-full shrink-0 sm:w-44 lg:w-40"><SearchableSelect value={selectedMonth} onChange={setSelectedMonth} options={monthFilterOptions} placeholder="Chọn tháng" getValue={item => (item as FilterOption).value} getLabel={item => (item as FilterOption).label} getSearchText={item => (item as FilterOption).label} allowEmpty={false} displaySelectedAsValue={false} inputClassName={fieldClass} /></div><div className="w-full shrink-0 sm:w-36 lg:w-32"><SearchableSelect value={selectedYear} onChange={setSelectedYear} options={yearFilterOptions} placeholder="Chọn năm" getValue={item => (item as FilterOption).value} getLabel={item => (item as FilterOption).label} getSearchText={item => (item as FilterOption).label} allowEmpty={false} displaySelectedAsValue={false} inputClassName={fieldClass} maxResults={100} /></div><button type="button" onClick={() => { setSearchText(''); setSelectedMonth('all'); setSelectedYear('all'); }} className="h-10 shrink-0 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600">Xóa lọc</button></div><table className="min-w-[1050px] w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm"><thead className="bg-zinc-100 text-left text-xs font-black uppercase text-zinc-600"><tr>{['Mã Amis','Tên sản xuất','Quy cách','Đơn vị','Tồn kho tối thiểu','Tồn kho tối đa','Tháng','Năm','Thao tác'].map(label => <th key={label} className="border-b border-zinc-200 px-3 py-3">{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={9} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : filteredItems.map(item => <tr key={item.id} className="border-b border-zinc-100"><td className="px-3 py-3 font-black">{item.ma_amis}</td><td className="px-3 py-3">{item.ten_san_xuat}</td><td className="px-3 py-3">{item.quy_cach || '-'}</td><td className="px-3 py-3">{item.don_vi}</td><td className="px-3 py-3">{item.ton_kho_toi_thieu}</td><td className="px-3 py-3">{item.ton_kho_toi_da}</td><td className="px-3 py-3">{item.thang}</td><td className="px-3 py-3">{item.nam}</td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" onClick={() => openEdit(item)} className="rounded-md border p-2 text-blue-700"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void remove(item)} className="rounded-md border p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}{!loading && filteredItems.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-sm font-semibold text-zinc-500">Không có dữ liệu phù hợp.</td></tr>}</tbody></table></div>
    {isModalOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 sm:items-center sm:p-4"><div className="max-h-[94dvh] w-full max-w-7xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b px-4 py-3"><h3 className="text-base font-black">Nhập dữ liệu Tồn kho tối thiểu - Tồn kho tối đa</h3><button type="button" onClick={() => setIsModalOpen(false)}><X className="h-5 w-5" /></button></div><div className="max-h-[78dvh] overflow-auto bg-zinc-50 p-3"><div className="space-y-3">{timeGroups.map(group => <section key={`${group.thang}-${group.nam}`} className="overflow-hidden rounded-lg border border-zinc-200 bg-white"><div className="flex items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-3 py-2"><span className="rounded-md bg-zinc-200 px-3 py-1 text-xs font-black">Thời gian {timeGroups.indexOf(group) + 1}</span><label className="flex items-center gap-2 text-xs font-bold">Tháng<select value={group.thang} onChange={e => setRows(prev => prev.map(row => row.thang === group.thang && row.nam === group.nam ? { ...row, thang: Number(e.target.value) } : row))} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs font-bold"><option value={1}>01</option><option value={2}>02</option><option value={3}>03</option><option value={4}>04</option><option value={5}>05</option><option value={6}>06</option><option value={7}>07</option><option value={8}>08</option><option value={9}>09</option><option value={10}>10</option><option value={11}>11</option><option value={12}>12</option></select></label><label className="flex items-center gap-2 text-xs font-bold">Năm<div className="w-28"><SearchableSelect value={String(group.nam)} onChange={value => setRows(prev => prev.map(row => row.thang === group.thang && row.nam === group.nam ? { ...row, nam: Number(value) } : row))} options={yearFilterOptions.filter(option => option.value !== 'all')} placeholder="Chọn năm" getValue={item => (item as FilterOption).value} getLabel={item => (item as FilterOption).label} getSearchText={item => (item as FilterOption).label} allowEmpty={false} displaySelectedAsValue={false} inputClassName="h-8 w-28 rounded-md border border-zinc-200 bg-white px-2 text-xs font-bold" maxResults={100} /></div></label><button type="button" onClick={() => removeTimeGroup(group.thang, group.nam)} className="ml-auto rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700">Xóa thời gian</button></div><div className="min-w-[1000px]"><div className="grid grid-cols-[2rem_1.3fr_1.3fr_1.2fr_6rem_8rem_8rem_5rem_5rem] gap-2 border-b border-zinc-100 px-3 py-2 text-[10px] font-black uppercase text-zinc-500"><span>#</span><span>Mã Amis</span><span>Tên sản xuất</span><span>Quy cách</span><span>Đơn vị</span><span>Tồn kho tối thiểu</span><span>Tồn kho tối đa</span><span>Thao tác</span><span /></div>{group.rows.map(({ row, index }, rowIndex) => <div key={index} className="grid grid-cols-[2rem_1.3fr_1.3fr_1.2fr_6rem_8rem_8rem_5rem_5rem] items-center gap-2 border-b border-zinc-100 px-3 py-1.5 last:border-b-0"><span className="text-center text-xs font-bold text-zinc-500">{rowIndex + 1}</span><SearchableSelect value={row.san_pham_id} onChange={value => selectProduct(index, value)} options={productOptions} placeholder="Chọn Mã Amis" getValue={item => (item as ProductRow).id} getLabel={item => (item as ProductRow).amisCode} getOptionLabel={item => { const p = item as ProductRow; return `${p.amisCode} - ${p.productionName || p.name}`; }} getSearchText={item => { const p = item as ProductRow; return `${p.amisCode} ${p.productionName} ${p.name}`; }} displaySelectedAsValue={false} /><input value={row.ten_san_xuat} readOnly className={`${fieldClass} bg-zinc-100`} /><input value={row.quy_cach} onChange={e => updateRow(index, { quy_cach: e.target.value })} className={fieldClass} /><select value={row.don_vi} onChange={e => updateRow(index, { don_vi: e.target.value as 'Tấm' | 'Cuộn' })} className={fieldClass}><option>Tấm</option><option>Cuộn</option></select><input type="number" step="1" min="0" value={row.ton_kho_toi_thieu} onChange={e => updateRow(index, { ton_kho_toi_thieu: e.target.value })} className={fieldClass} /><input type="number" step="1" min="0" value={row.ton_kho_toi_da} onChange={e => updateRow(index, { ton_kho_toi_da: e.target.value })} className={fieldClass} /><div className="flex gap-1"><button type="button" onClick={() => addGroupRow(group.thang, group.nam)} className="rounded-md border border-blue-200 bg-white p-2 text-blue-700"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)} className="rounded-md border border-rose-200 bg-white p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button></div><span /></div>)}</div></section>)}</div><button type="button" onClick={addTimeGroup} className="mt-3 flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> Thêm mới thời gian</button>{error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}</div><div className="flex justify-end gap-2 border-t bg-white px-4 py-3"><button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-bold">Hủy bỏ</button><button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu dữ liệu</button></div></div></div>}
  </div>;
}
