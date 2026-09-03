import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { generateNextOrderCode, normalizeOrders, type OrderRow } from '../don-hang';
import { normalizeProducts, type ProductRow } from '../san-pham';
import {
  calculateOrderConversion,
  conversionSupportsUnit,
  allowedOrderUnits,
  ORDER_STATUS_OPTIONS,
  type OrderProductConversion
} from '../_shared/orderHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';

const INVENTORY_ORDER_TYPE = 'Đơn tồn kho tối thiểu';
const fieldClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

type InventoryAlert = {
  id: number;
  san_pham_id: string;
  ma_amis: string;
  ten_sp: string;
  ten_san_xuat: string;
  ton_kho: number;
  ton_kho_toi_thieu: number;
  ton_kho_toi_da: number;
  thang: number;
  nam: number;
};

type ApiResponse = {
  items?: InventoryAlert[];
  total?: number;
  source?: string;
  thang: number;
  nam: number;
  error?: string;
};

type InventoryOrderProduct = {
  productId: string;
  productCode: string;
  productName: string;
  productionName: string;
  unit: string;
  quantity: string;
};

type InventoryOrderForm = {
  orderCode: string;
  createdAt: string;
  note: string;
  status: string;
  products: InventoryOrderProduct[];
};

function currentDateInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyInventoryOrderProduct(): InventoryOrderProduct {
  return {
    productId: '',
    productCode: '',
    productName: '',
    productionName: '',
    unit: 'Tấm',
    quantity: ''
  };
}

function emptyInventoryOrderForm(): InventoryOrderForm {
  return {
    orderCode: '',
    createdAt: currentDateInput(),
    note: '',
    status: ORDER_STATUS_OPTIONS[0] || 'Chờ sx',
    products: [emptyInventoryOrderProduct()]
  };
}

function getOrderLinesForForm(order: OrderRow): InventoryOrderProduct[] {
  const products = order.products.length > 0
    ? order.products
    : [{
        productId: '',
        productCode: order.productCode,
        productName: order.productName,
        productionName: '',
        unit: order.unit,
        quantity: order.quantity
      }];

  return products.map(product => ({
    productId: product.productId || '',
    productCode: product.productCode || '',
    productName: product.productName || '',
    productionName: product.productionName || '',
    unit: product.unit || 'Tấm',
    quantity: product.quantity || ''
  }));
}

function getConversionResults(
  product: InventoryOrderProduct,
  products: ProductRow[],
  conversions: OrderProductConversion[]
) {
  const catalogProduct = products.find(item => item.id === product.productId);
  const unit = resolveInventoryUnit(catalogProduct, product.unit);
  const conversion = conversions
    .filter(item => item.sanPhamId === product.productId)
    .find(item => conversionSupportsUnit(item, unit));
  return conversion
    ? calculateOrderConversion(
        product.quantity,
        unit,
        conversion,
        (catalogProduct as (ProductRow & { group?: string }) | undefined)?.group || ''
      )
    : [];
}

function resolveInventoryUnit(product: ProductRow | undefined, unit: string) {
  const allowedUnits = allowedOrderUnits(product);
  return allowedUnits.includes(unit) ? unit : allowedUnits[0] || unit || product?.unit || 'Tấm';
}

export function InventoryAlertPanel({ onBack }: { onBack: () => void }) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productConversions, setProductConversions] = useState<OrderProductConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [message, setMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [thang, setThang] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'orders'>('alerts');
  const [form, setForm] = useState<InventoryOrderForm>(emptyInventoryOrderForm());

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [alertsRes, ordersRes, productsRes] = await Promise.all([
        fetch('/api/canh-bao-ton-kho'),
        fetch('/api/don-hang'),
        fetch('/api/san-pham?format=table'),
      ]);
      const conversionsRes = await fetch('/api/bang-quy-doi-san-pham?page=1&pageSize=1000');
      const alertsData: ApiResponse = await alertsRes.json();
      const ordersData = await ordersRes.json().catch(() => ({}));
      const productsData = await productsRes.json().catch(() => ({}));
      const conversionsData = await conversionsRes.json().catch(() => ({}));
      if (!alertsRes.ok) throw new Error(alertsData.error || 'Không thể tải dữ liệu cảnh báo tồn kho.');
      setAlerts(alertsData.items || []);
      setThang(alertsData.thang);
      setOrders(ordersRes.ok ? normalizeOrders(ordersData) : []);
      setProducts(productsRes.ok ? normalizeProducts(productsData) : []);
      setProductConversions(
        conversionsRes.ok && Array.isArray(conversionsData.items)
          ? conversionsData.items as OrderProductConversion[]
          : []
      );
    } catch (e: any) {
      setError(e.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const normalizedSearch = searchText.trim().toLocaleLowerCase('vi');
  const minimumStockOrders = useMemo(
    () => orders.filter(order => order.orderType === INVENTORY_ORDER_TYPE),
    [orders]
  );
  const filteredAlerts = useMemo(
    () => alerts.filter(alert =>
      !normalizedSearch ||
      `${alert.ma_amis} ${alert.ten_sp} ${alert.ten_san_xuat}`.toLocaleLowerCase('vi').includes(normalizedSearch)
    ),
    [alerts, normalizedSearch]
  );
  const filteredOrders = useMemo(
    () => minimumStockOrders.filter(order =>
      !normalizedSearch ||
      `${order.orderCode} ${order.note} ${order.productName}`.toLocaleLowerCase('vi').includes(normalizedSearch)
    ),
    [minimumStockOrders, normalizedSearch]
  );
  const productOptions = useMemo(
    () => {
      const alertProductIds = new Set(
        alerts.map(alert => String(alert.san_pham_id || '').trim()).filter(Boolean)
      );
      return products.filter(product =>
        product.id &&
        product.amisCode &&
        product.amisCode !== '-' &&
        alertProductIds.has(String(product.id).trim())
      );
    },
    [alerts, products]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyInventoryOrderForm(),
      orderCode: generateNextOrderCode(orders.map(order => order.orderCode))
    });
    setError('');
    setModalError('');
    setMessage('');
    setIsModalOpen(true);
  };

  const openEdit = (order: OrderRow) => {
    setEditingId(order.id);
    setForm({
      orderCode: order.orderCode === '-' ? '' : order.orderCode,
      createdAt: order.createdAt ? order.createdAt.slice(0, 10) : currentDateInput(),
      note: order.note === '-' ? '' : order.note,
      status: order.status === '-' ? 'Chờ sx' : order.status,
      products: getOrderLinesForForm(order)
    });
    setError('');
    setModalError('');
    setMessage('');
    setIsModalOpen(true);
  };

  const updateProduct = (index: number, patch: Partial<InventoryOrderProduct>) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map((product, productIndex) =>
        productIndex === index ? { ...product, ...patch } : product
      )
    }));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = productOptions.find(item => item.id === productId);
    updateProduct(index, {
      productId,
      productCode: product?.amisCode || '',
      productName: product?.name || '',
      productionName: product?.productionName || '',
      unit: resolveInventoryUnit(product, '')
    });
  };

  const save = async () => {
    const validProducts = form.products.filter(product => product.productId && product.productCode);
    if (!form.orderCode.trim()) return setModalError('Vui lòng nhập mã đơn hàng.');
    if (!form.createdAt.trim()) return setModalError('Vui lòng chọn ngày tạo.');
    if (validProducts.length === 0) return setModalError('Vui lòng chọn ít nhất một sản phẩm.');
    if (validProducts.some(product => !Number.isFinite(Number(product.quantity)) || Number(product.quantity) <= 0)) {
      return setModalError('Số lượng mỗi sản phẩm phải lớn hơn 0.');
    }

    setSaving(true);
    setError('');
    setModalError('');
    try {
      const payload = {
        orderCode: form.orderCode.trim(),
        orderType: INVENTORY_ORDER_TYPE,
        note: form.note.trim(),
        status: form.status,
        createdAt: form.createdAt,
        products: validProducts.map(product => ({
          san_pham_id: product.productId,
          ma_sp: product.productCode,
          ten_sp: product.productName,
          ten_san_xuat: product.productionName,
          don_vi: resolveInventoryUnit(products.find(item => item.id === product.productId), product.unit),
          so_luong: Number(product.quantity),
          ket_qua_quy_doi: getConversionResults(product, products, productConversions)
            .map(([, value, unit]) => ({ don_vi: unit, gia_tri: Math.round(value * 1_000_000) / 1_000_000 }))
        }))
      };
      const response = await fetch(
        editingId ? `/api/don-hang/${editingId}` : '/api/don-hang',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không thể lưu đơn tồn kho tối thiểu.');
      setIsModalOpen(false);
      setMessage(editingId ? 'Đã cập nhật đơn tồn kho tối thiểu.' : 'Đã thêm đơn tồn kho tối thiểu.');
      await load();
    } catch (e: any) {
      setModalError(e.message || 'Không thể lưu đơn tồn kho tối thiểu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-4 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <button type="button" onClick={onBack} className="mb-1 text-xs font-bold text-slate-500 hover:text-slate-900">← Quay lại</button>
            <h1 className="text-lg font-black text-zinc-900 sm:text-xl">Cảnh báo tồn kho tháng {thang}</h1>
          </div>
          {activeTab === 'orders' && <button type="button" onClick={openCreate} className="flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-extrabold text-white">
            <Plus className="h-4 w-4" /> Thêm đơn tồn kho tối thiểu
          </button>}
        </div>
      </section>

      {!isModalOpen && (error || message) && <div className={`rounded-lg px-4 py-3 text-xs font-bold ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Tìm mã AMIS, tên sản xuất, mã đơn hàng..." className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none" />
        {searchText && <button type="button" onClick={() => setSearchText('')} className="text-xs font-bold text-slate-500">Xóa</button>}
      </div>

      <div className="grid gap-2 border-b border-slate-200 bg-white p-3 shadow-card sm:grid-cols-2">
        {[
          {
            value: 'alerts' as const,
            label: `Cảnh báo tồn kho tháng ${thang}`,
            description: 'Danh sách sản phẩm đang sắp hết tồn kho'
          },
          {
            value: 'orders' as const,
            label: 'Danh sách đơn tồn kho tối thiểu',
            description: 'Theo dõi và chỉnh sửa các đơn đã tạo'
          }
        ].map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            aria-pressed={activeTab === tab.value}
            className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
              activeTab === tab.value
                ? 'border-[#ef1b2d] bg-red-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className="block text-sm font-black text-slate-900">{tab.label}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{tab.description}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <section className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-card"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></section>
      ) : (
        activeTab === 'alerts' ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-800">Sản phẩm sắp hết tồn kho</div>
            {filteredAlerts.length === 0 ? <div className="p-8 text-center"><AlertTriangle className="mx-auto h-12 w-12 text-amber-500" /><p className="mt-3 text-sm font-semibold text-zinc-600">Không có sản phẩm nào phù hợp.</p></div> : (
              <div className="overflow-auto"><table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-600"><tr><th className="border-b px-4 py-3">Mã AMIS</th><th className="border-b px-4 py-3">Tên sản phẩm</th><th className="border-b px-4 py-3">Tên sản xuất</th><th className="border-b px-4 py-3 text-right">Tồn kho</th><th className="border-b px-4 py-3 text-right">Tồn kho tối thiểu</th></tr></thead>
                <tbody>{filteredAlerts.map(alert => <tr key={alert.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-black text-rose-600">{alert.ma_amis || '-'}</td><td className="px-4 py-3">{alert.ten_sp || '-'}</td><td className="px-4 py-3">{alert.ten_san_xuat || '-'}</td><td className="px-4 py-3 text-right font-semibold text-rose-600">{alert.ton_kho}</td><td className="px-4 py-3 text-right text-slate-600">{alert.ton_kho_toi_thieu}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-800">Đơn tồn kho tối thiểu</div>
            <div className="overflow-auto"><table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-600"><tr><th className="border-b px-4 py-3">Mã đơn</th><th className="border-b px-4 py-3">Ngày tạo</th><th className="border-b px-4 py-3">Sản phẩm</th><th className="border-b px-4 py-3">Trạng thái</th><th className="border-b px-4 py-3 text-center">Thao tác</th></tr></thead>
              <tbody>{filteredOrders.map(order => <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-black text-blue-700">{order.orderCode}</td><td className="px-4 py-3">{order.createdAt?.slice(0, 10) || '-'}</td><td className="px-4 py-3">{order.productName || '-'}</td><td className="px-4 py-3">{order.status || '-'}</td><td className="px-4 py-3 text-center"><button type="button" onClick={() => openEdit(order)} className="rounded-md border p-2 text-blue-700" title="Sửa"><Pencil className="h-4 w-4" /></button></td></tr>)}</tbody>
            </table></div>
            {filteredOrders.length === 0 && <div className="p-8 text-center text-sm font-semibold text-slate-500">Chưa có đơn tồn kho tối thiểu.</div>}
          </section>
        )
      )}

      {isModalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-sm">
        <div className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-base font-black text-slate-900">{editingId ? 'Sửa đơn tồn kho tối thiểu' : 'Thêm đơn tồn kho tối thiểu'}</h2><button type="button" onClick={() => setIsModalOpen(false)} disabled={saving}><X className="h-5 w-5" /></button></div>
          {modalError && <div className="mx-4 mt-3 rounded-lg bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{modalError}</div>}
          <div className="min-h-0 overflow-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Mã đơn *</span><input value={form.orderCode} onChange={event => setForm(prev => ({ ...prev, orderCode: event.target.value }))} className={fieldClass} /></label>
              <label className="space-y-1.5"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Ngày tạo *</span><input type="date" value={form.createdAt} onChange={event => setForm(prev => ({ ...prev, createdAt: event.target.value }))} className={fieldClass} /></label>
              <label className="space-y-1.5"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Loại đơn</span><input value={INVENTORY_ORDER_TYPE} readOnly className={`${fieldClass} bg-slate-100`} /></label>
              <label className="space-y-1.5"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Trạng thái</span><select value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))} className={fieldClass}>{ORDER_STATUS_OPTIONS.map(status => <option key={status}>{status}</option>)}</select></label>
              <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Ghi chú đơn hàng</span><textarea value={form.note} onChange={event => setForm(prev => ({ ...prev, note: event.target.value }))} rows={2} className={fieldClass} /></label>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2"><span className="text-xs font-black uppercase tracking-wider text-slate-600">Danh sách sản phẩm</span><button type="button" onClick={() => setForm(prev => ({ ...prev, products: [...prev.products, emptyInventoryOrderProduct()] }))} className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" /> Thêm dòng</button></div>
              <div className="min-w-[1200px]">
                <div className="grid grid-cols-[2rem_1.1fr_1.1fr_1.3fr_5rem_6rem_5rem_5rem_5rem_2.5rem] gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-black uppercase text-slate-500"><span>#</span><span>Mã sản phẩm</span><span>Tên sản phẩm</span><span>Tên sản xuất</span><span>ĐVT</span><span>Số lượng</span><span>KG</span><span>M2</span><span>M dài</span><span /></div>
                {form.products.map((product, index) => <div key={`${index}-${product.productId}`} className="grid grid-cols-[2rem_1.1fr_1.1fr_1.3fr_5rem_6rem_5rem_5rem_5rem_2.5rem] items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
                  <span className="text-center text-xs font-bold text-slate-500">{index + 1}</span>
                  <SearchableSelect
                    value={product.productId}
                    onChange={productId => selectProduct(index, productId)}
                    options={productOptions}
                    placeholder="Tìm mã AMIS, tên sản phẩm..."
                    getValue={item => (item as ProductRow).id}
                    getLabel={item => (item as ProductRow).amisCode}
                    getOptionLabel={item => {
                      const selected = item as ProductRow;
                      return `${selected.amisCode} - ${selected.productionName || selected.name}`;
                    }}
                    getSearchText={item => {
                      const selected = item as ProductRow;
                      return `${selected.amisCode} ${selected.name} ${selected.productionName}`;
                    }}
                    displaySelectedAsValue={false}
                    inputClassName={fieldClass}
                    maxResults={400}
                  />
                  <input value={product.productName} readOnly className={`${fieldClass} bg-slate-100`} />
                  <input value={product.productionName} readOnly className={`${fieldClass} bg-slate-100`} />
                  {(() => {
                    const selectedProduct = productOptions.find(item => item.id === product.productId);
                    const allowedUnits = allowedOrderUnits(selectedProduct);
                    return allowedUnits.length > 0 ? (
                      <select value={resolveInventoryUnit(selectedProduct, product.unit)} onChange={event => updateProduct(index, { unit: event.target.value })} className={fieldClass}>
                        {allowedUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    ) : (
                      <input value={product.unit} onChange={event => updateProduct(index, { unit: event.target.value })} className={fieldClass} />
                    );
                  })()}
                  <input type="number" min="0" step="any" value={product.quantity} onChange={event => updateProduct(index, { quantity: event.target.value })} className={fieldClass} />
                  {(['kg', 'm2', 'm dài'] as const).map(unit => {
                    const value = getConversionResults(product, products, productConversions)
                      .find(([, , resultUnit]) => resultUnit === unit)?.[1];
                    return <input key={unit} value={value !== undefined ? value.toFixed(3) : ''} readOnly className={`${fieldClass} bg-slate-100 text-right`} />;
                  })}
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, products: prev.products.length > 1 ? prev.products.filter((_, productIndex) => productIndex !== index) : [emptyInventoryOrderProduct()] }))} className="rounded-md border p-2 text-rose-700" title="Xóa dòng"><Trash2 className="h-4 w-4" /></button>
                </div>)}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setIsModalOpen(false)} disabled={saving} className="rounded-lg border px-4 py-2 text-xs font-bold">Hủy</button><button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu</button></div>
        </div>
      </div>}
    </div>
  );
}
