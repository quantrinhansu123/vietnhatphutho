import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import type { MixingReportLine } from './MixingReportForm';
import {
  buildMixingLinesFromOrderProducts,
  buildMixingOrderProductCandidates,
  formatMixingBomSummary,
  type MixingCatalogProduct,
  type MixingSalesOrder
} from '../utils/mixingOrderAutofill';

export default function MixingOrderAutofillModal({
  open,
  orders,
  catalogProducts,
  materials,
  existingLineCount,
  onClose,
  onApply
}: {
  open: boolean;
  orders: MixingSalesOrder[];
  catalogProducts: MixingCatalogProduct[];
  materials: Array<{ code: string; name: string; unit: string }>;
  existingLineCount: number;
  onClose: () => void;
  onApply: (lines: MixingReportLine[]) => void;
}) {
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productOrderFilter, setProductOrderFilter] = useState('all');
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setOrderSearch('');
      setSelectedOrderCodes([]);
      setProductSearch('');
      setProductOrderFilter('all');
      setSelectedProductKeys([]);
    }
  }, [open]);

  const orderOptions = useMemo(() => {
    const normalized = orderSearch.trim().toLowerCase();
    return orders
      .filter(order => order.productLines.some(line => line.productCode.trim()))
      .filter(order => {
        if (!normalized) return true;
        const products = order.productLines.map(line => `${line.productCode} ${line.productName}`).join(' ');
        return `${order.orderCode} ${order.customer} ${products}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => a.orderCode.localeCompare(b.orderCode, 'vi'));
  }, [orderSearch, orders]);

  const productCandidates = useMemo(
    () => buildMixingOrderProductCandidates(orders, selectedOrderCodes, catalogProducts),
    [orders, selectedOrderCodes, catalogProducts]
  );

  const filteredProducts = useMemo(() => {
    const byOrder =
      productOrderFilter === 'all'
        ? productCandidates
        : productCandidates.filter(item => item.orderCode === productOrderFilter);

    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) return byOrder;

    return byOrder.filter(item =>
      `${item.productCode} ${item.productName} ${item.orderCode} ${formatMixingBomSummary(item.bomItems)}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [productCandidates, productOrderFilter, productSearch]);

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every(item => selectedProductKeys.includes(item.key));

  const toggleOrderCode = (orderCode: string) => {
    setSelectedOrderCodes(prev => {
      const isSelected = prev.includes(orderCode);
      if (isSelected) {
        setSelectedProductKeys(keys => keys.filter(key => !key.startsWith(`${orderCode}::`)));
        setProductOrderFilter(current => (current === orderCode ? 'all' : current));
        return prev.filter(code => code !== orderCode);
      }
      return [...prev, orderCode];
    });
  };

  const toggleProductKey = (key: string) => {
    setSelectedProductKeys(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
  };

  const toggleSelectAllFiltered = () => {
    const keys = filteredProducts.map(item => item.key);
    if (allFilteredSelected) {
      setSelectedProductKeys(prev => prev.filter(key => !keys.includes(key)));
      return;
    }
    setSelectedProductKeys(prev => [...new Set([...prev, ...keys])]);
  };

  const handleApply = () => {
    if (selectedProductKeys.length === 0) return;
    const lines = buildMixingLinesFromOrderProducts(
      productCandidates,
      selectedProductKeys,
      materials,
      existingLineCount + 1
    );
    onApply(lines);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg border border-ink-200 bg-white shadow-2xl sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-dashed border-ink-200 px-3 py-2.5">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-zinc-950">Lấy SP từ đơn hàng</h4>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Chọn đơn và sản phẩm — hệ thống điền sẵn % phối trộn NVL theo định mức SP
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-ink-200 px-2.5 text-[11px] font-semibold text-ink-600 transition hover:bg-ink-50"
          >
            Đóng
          </button>
        </div>

        <div className="border-b border-zinc-100 p-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={orderSearch}
              onChange={event => setOrderSearch(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng, mã SP..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="max-h-[28vh] overflow-y-auto p-4">
          {orderOptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm font-bold text-zinc-400">
              Không có đơn hàng phù hợp.
            </div>
          ) : (
            <div className="space-y-2">
              {orderOptions.map(order => {
                const checked = selectedOrderCodes.includes(order.orderCode);
                return (
                  <label
                    key={order.id}
                    className={`block cursor-pointer rounded-md border p-2.5 transition ${
                      checked ? 'border-brand-500/35 bg-brand-50' : 'border-ink-200 bg-white hover:bg-ink-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrderCode(order.orderCode)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-zinc-950">{order.orderCode || '-'}</span>
                          <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-black text-zinc-600">
                            {order.productLines.length} SP
                          </span>
                          <span className="text-xs font-semibold text-zinc-500">{order.customer}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-zinc-600">
                          {order.productLines
                            .map(line => `${line.productCode}${line.productName ? ` · ${line.productName}` : ''}`)
                            .join(' | ')}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {selectedOrderCodes.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/80 p-4">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Chọn sản phẩm</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lọc theo đơn</span>
                <select
                  value={productOrderFilter}
                  onChange={event => setProductOrderFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
                >
                  <option value="all">Tất cả đơn đã chọn ({selectedOrderCodes.length})</option>
                  {selectedOrderCodes.map(orderCode => (
                    <option key={orderCode} value={orderCode}>
                      {orderCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tìm sản phẩm</span>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
                  <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                  <input
                    value={productSearch}
                    onChange={event => setProductSearch(event.target.value)}
                    placeholder="Gõ mã SP, tên hàng..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                  />
                </div>
              </label>
            </div>

            <label className="mt-3 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                disabled={filteredProducts.length === 0}
                className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20 disabled:opacity-50"
              />
              <span className="text-xs font-extrabold text-zinc-700">Chọn tất cả (đang lọc)</span>
            </label>

            <div className="mt-3 max-h-[24vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs font-bold text-zinc-400">
                  {productSearch.trim() ? 'Không có sản phẩm phù hợp.' : 'Đơn đã chọn chưa có sản phẩm.'}
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredProducts.map(product => {
                    const checked = selectedProductKeys.includes(product.key);
                    return (
                      <label
                        key={product.key}
                        className={`flex cursor-pointer items-start gap-2.5 px-2.5 py-2 transition ${
                          checked ? 'bg-brand-50/70' : 'hover:bg-ink-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductKey(product.key)}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-zinc-950">{product.productCode}</span>
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-black text-zinc-600">
                              {product.orderCode}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                product.bomItems.length > 0 ? 'text-success-700' : 'text-warning-700'
                              }`}
                            >
                              {product.bomItems.length > 0
                                ? `${product.bomItems.length} NVL`
                                : 'Chưa có định mức'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-zinc-700">{product.productName}</p>
                          <p className="mt-1 text-[11px] font-medium leading-5 text-zinc-500">
                            {formatMixingBomSummary(product.bomItems)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
          <span className="text-xs font-bold text-zinc-500">
            Đã chọn {selectedOrderCodes.length} đơn · {selectedProductKeys.length} SP
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedOrderCodes([]);
                setSelectedProductKeys([]);
                setProductOrderFilter('all');
                setProductSearch('');
              }}
              className="h-9 rounded-md border border-ink-200 bg-white px-3 text-[11px] font-semibold text-ink-600 transition hover:bg-ink-50"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedProductKeys.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClipboardCheck className="h-4 w-4" />
              Điền định mức
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
