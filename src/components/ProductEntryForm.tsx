import React, { useState, useMemo } from 'react';
import { ProductEntry, STANDARD_PRODUCTS, ProductDefinition } from '../types';
import { Sparkles, ClipboardList, Scale, Info, Search } from 'lucide-react';
import { formatNumber } from '../utils';

interface ProductEntryFormProps {
  data: ProductEntry;
  onChange: (updated: Partial<ProductEntry>) => void;
}

export default function ProductEntryForm({ data, onChange }: ProductEntryFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedProduct = useMemo(() => {
    return STANDARD_PRODUCTS.find(p => p.code === data.productCode);
  }, [data.productCode]);

  const normWeightPerRoll = selectedProduct ? selectedProduct.normWeight : 0;
  const theoreticalTotalWeight = Number(data.rolls || 0) * normWeightPerRoll;

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return STANDARD_PRODUCTS;
    const cleanQuery = searchQuery.toLowerCase().trim();
    return STANDARD_PRODUCTS.filter(p =>
      p.code.toLowerCase().includes(cleanQuery) ||
      p.name.toLowerCase().includes(cleanQuery)
    );
  }, [searchQuery]);

  const handleSelectProduct = (product: ProductDefinition) => {
    onChange({ productCode: product.code });
    setSearchQuery(product.code);
    setShowDropdown(false);
  };

  return (
    <div className="form-section" id="product-entry-section">
      <h3 className="form-header">
        <Scale className="w-4 h-4 text-accent-700" />
        Chi tiết thành phẩm
      </h3>

      {/* Autocomplete Mã Sản Phẩm */}
      <div className="space-y-1 relative">
        <label className="field-label" htmlFor="productCodeSearch">
          <Search className="w-3 h-3 text-ink-400" />
          Mã sản phẩm / Quy cách <span className="text-rose-500">*</span>
        </label>

        <div className="relative">
          <input
            type="text"
            id="productCodeSearch"
            className="field-input pl-8 pr-8"
            placeholder="Tìm kiếm mã (ví dụ: PE-LD100, PP...)"
            value={searchQuery || (selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : '')}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) {
                onChange({ productCode: '' });
              }
            }}
            onFocus={() => setShowDropdown(true)}
          />
          <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-ink-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          {(searchQuery || data.productCode) && (
            <button
              type="button"
              className="absolute inset-y-0 right-2 flex items-center text-ink-400 hover:text-ink-700 px-1 text-[14px]"
              onClick={() => {
                setSearchQuery('');
                onChange({ productCode: '' });
                setShowDropdown(true);
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Floating Dropdown Suggestion List */}
        {showDropdown && (
          <div className="absolute z-30 w-full mt-1 bg-white border border-ink-200 rounded-md max-h-56 overflow-y-auto divide-y divide-ink-100" style={{ boxShadow: 'var(--shadow-elevated)' }}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  id={`prod-item-${p.code}`}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-ink-50 transition flex flex-col gap-0.5"
                  onClick={() => handleSelectProduct(p)}
                >
                  <span className="text-[13px] font-semibold text-ink-900">{p.code}</span>
                  <span className="text-[11px] text-ink-500 flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="pill bg-accent-50 text-accent-700 shrink-0">
                      {p.normWeight} kg/cuộn
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-center text-[12px] text-ink-400 italic">
                Không tìm thấy mã nào tương xứng
              </div>
            )}
          </div>
        )}

        {/* Quick Selection badges for the busy workers */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {STANDARD_PRODUCTS.slice(0, 4).map((p) => {
            const isSelected = data.productCode === p.code;
            return (
              <button
                key={p.code}
                type="button"
                id={`badge-prod-${p.code}`}
                onClick={() => handleSelectProduct(p)}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold transition ${
                  isSelected
                    ? 'bg-accent-700 border-accent-700 text-white'
                    : 'bg-white border-ink-200 hover:border-ink-300 text-ink-600'
                }`}
              >
                {p.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Production Quantities */}
      <div className="field-grid-2">
        <div className="space-y-1">
          <label className="field-label" htmlFor="rolls">
            <ClipboardList className="w-3 h-3 text-ink-400" />
            Số cuộn đạt <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              id="rolls"
              min="0"
              step="1"
              value={data.rolls || ''}
              className="field-input pr-10 num text-[14px] font-semibold"
              placeholder="0"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({ rolls: isNaN(val) ? 0 : val });
              }}
            />
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[11px] font-semibold text-ink-400">
              cuộn
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="field-label" htmlFor="actualWeight">
            <Scale className="w-3 h-3 text-ink-400" />
            Cân nặng thực tế <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              id="actualWeight"
              min="0"
              step="0.1"
              value={data.actualWeight || ''}
              className="field-input pr-9 num text-[14px] font-semibold"
              placeholder="0.0"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChange({ actualWeight: isNaN(val) ? 0 : val });
              }}
            />
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[11px] font-semibold text-ink-400">
              kg
            </div>
          </div>
        </div>
      </div>

      {/* Automatic Norm Weights Calculation Display */}
      {selectedProduct && (
        <div className="rounded-md bg-ink-50/70 border border-ink-200 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-500">
            <Sparkles className="w-3 h-3 text-warning-500" />
            Định mức tự động
          </div>

          <div className="grid grid-cols-2 gap-2.5 divide-x divide-ink-200/80">
            <div>
              <p className="text-[10px] text-ink-500 font-medium">Định mức/cuộn</p>
              <p className="num text-[14px] font-semibold text-ink-800 mt-0.5">
                {formatNumber(normWeightPerRoll)} <span className="text-[10px] font-semibold text-ink-500">kg/cuộn</span>
              </p>
            </div>
            <div className="pl-2.5">
              <p className="text-[10px] text-ink-500 font-medium">Tổng dự kiến</p>
              <p id="calc-theoretical-weight" className="num text-[14px] font-semibold text-ink-800 mt-0.5">
                {formatNumber(theoreticalTotalWeight)} <span className="text-[10px] font-semibold text-ink-500">kg</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1.5 pt-1.5 border-t border-ink-200/80 text-[10px] text-ink-500 italic leading-relaxed">
            <Info className="w-3 h-3 text-ink-400 shrink-0 mt-0.5" />
            <span>
              Cân nặng thực tế đối chiếu với bột nhựa phối trộn ở Bước tiếp theo để tính tỉ lệ hao hụt dây chuyền đùn nhựa.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}