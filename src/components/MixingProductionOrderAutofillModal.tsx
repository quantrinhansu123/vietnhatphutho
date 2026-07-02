import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import type { MixingRoundItem } from './MixingReportForm';
import {
  buildMixingProductionOrderProductCandidates,
  buildMixingRoundItemsFromProductCandidates,
  filterMixingProductionOrders,
  formatMixingBomSummary,
  type MixingCatalogProduct,
  type MixingProductionOrder
} from '../utils/mixingOrderAutofill';

export default function MixingProductionOrderAutofillModal({
  open,
  roundLabel,
  orders,
  catalogProducts,
  materials,
  filters,
  onClose,
  onApply
}: {
  open: boolean;
  roundLabel: string;
  orders: MixingProductionOrder[];
  catalogProducts: MixingCatalogProduct[];
  materials: Array<{ code: string; name: string; unit: string }>;
  filters: { ngay: string; ca: string; maMay: string; tenMay: string };
  onClose: () => void;
  onApply: (items: MixingRoundItem[]) => void;
}) {
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setOrderSearch('');
      setSelectedOrderCodes([]);
      setProductSearch('');
      setSelectedProductKeys([]);
    }
  }, [open]);

  const matchedOrders = useMemo(
    () => filterMixingProductionOrders(orders, filters),
    [orders, filters]
  );

  const orderOptions = useMemo(() => {
    const normalized = orderSearch.trim().toLowerCase();
    return matchedOrders
      .filter(order => order.productLines.some(line => line.productCode.trim()))
      .filter(order => {
        if (!normalized) return true;
        const products = order.productLines.map(line => `${line.productCode} ${line.productName}`).join(' ');
        return `${order.orderCode} ${order.machine} ${products}`.toLowerCase().includes(normalized);
      })
      .sort((a, b) => a.orderCode.localeCompare(b.orderCode, 'vi'));
  }, [matchedOrders, orderSearch]);

  const productCandidates = useMemo(
    () => buildMixingProductionOrderProductCandidates(matchedOrders, selectedOrderCodes, catalogProducts),
    [matchedOrders, selectedOrderCodes, catalogProducts]
  );

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) return productCandidates;
    return productCandidates.filter(item =>
      `${item.productCode} ${item.productName} ${item.orderCode} ${formatMixingBomSummary(item.bomItems)}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [productCandidates, productSearch]);

  const toggleOrderCode = (orderCode: string) => {
    setSelectedOrderCodes(prev => {
      const isSelected = prev.includes(orderCode);
      if (isSelected) {
        setSelectedProductKeys(keys => keys.filter(key => !key.startsWith(`${orderCode}::`)));
        return prev.filter(code => code !== orderCode);
      }
      return [...prev, orderCode];
    });
  };

  const toggleProductKey = (key: string) => {
    setSelectedProductKeys(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
  };

  const handleApply = () => {
    if (selectedProductKeys.length === 0) return;
    const items = buildMixingRoundItemsFromProductCandidates(
      productCandidates,
      selectedProductKeys,
      materials
    );
    onApply(items);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-zinc-950">
              Nguyên liệu theo Lệnh sản xuất · {roundLabel}
            </h4>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Lọc theo ngày, ca và máy đang nhập — chọn lệnh SX và sản phẩm để điền định mức NVL
              {!filters.ca.trim() ? ' · Chưa chọn ca: hiển thị mọi lệnh SX trong ngày/máy' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
          >
            Đóng
          </button>
        </div>

        {matchedOrders.length === 0 ? (
          <div className="p-6 text-center text-sm font-bold text-zinc-500">
            Không có lệnh sản xuất phù hợp ngày/ca/máy hiện tại.
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 p-4">
              <label className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  value={orderSearch}
                  onChange={event => setOrderSearch(event.target.value)}
                  placeholder="Tìm mã lệnh SX, máy, mã SP..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="max-h-[28vh] overflow-y-auto p-4">
              {orderOptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm font-bold text-zinc-400">
                  Không có lệnh SX phù hợp.
                </div>
              ) : (
                <div className="space-y-2">
                  {orderOptions.map(order => {
                    const checked = selectedOrderCodes.includes(order.orderCode);
                    return (
                      <label
                        key={order.id}
                        className={`block cursor-pointer rounded-xl border p-3 transition ${
                          checked ? 'border-[#ef1b2d]/35 bg-red-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
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
                              <span className="text-xs font-semibold text-zinc-500">{order.machine || '-'}</span>
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

                <div className="mt-3 max-h-[24vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white">
                  {filteredProducts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs font-bold text-zinc-400">
                      Không có sản phẩm phù hợp.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {filteredProducts.map(product => {
                        const checked = selectedProductKeys.includes(product.key);
                        return (
                          <label
                            key={product.key}
                            className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition ${
                              checked ? 'bg-red-50/70' : 'hover:bg-zinc-50'
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
                                    product.bomItems.length > 0 ? 'text-emerald-700' : 'text-amber-700'
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
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
          <span className="text-xs font-bold text-zinc-500">
            Đã chọn {selectedOrderCodes.length} lệnh · {selectedProductKeys.length} SP
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedProductKeys.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClipboardCheck className="h-4 w-4" />
              Điền vào {roundLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
