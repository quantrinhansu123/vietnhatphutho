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

  // Retrieve current active product definition
  const selectedProduct = useMemo(() => {
    return STANDARD_PRODUCTS.find(p => p.code === data.productCode);
  }, [data.productCode]);

  // Compute standard theoretical/norm weight
  const normWeightPerRoll = selectedProduct ? selectedProduct.normWeight : 0;
  const theoreticalTotalWeight = Number(data.rolls || 0) * normWeightPerRoll;

  // Filter products based on query
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
    <div className="space-y-6" id="product-entry-section">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Scale className="w-5 h-5 text-success-600" />
          Chi Tiết Thành Phẩm
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">Chọn mã sản phẩm và định lượng thành phẩm hoàn thành trong ca</p>
      </div>

      {/* Autocomplete Mã Sản Phẩm */}
      <div className="space-y-2 relative">
        <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5" htmlFor="productCodeSearch">
          <Search className="w-4 h-4 text-slate-400" />
          Mã Sản Phẩm / Quy Cách <span className="text-rose-500">*</span>
        </label>
        
        {/* Simple Auto-complete Search input */}
        <div className="relative">
          <input
            type="text"
            id="productCodeSearch"
            className="w-full h-12 pl-10 pr-10 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 text-slate-800 text-sm font-medium transition placeholder:text-slate-400"
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
            style={{ minHeight: '44px' }}
          />
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4.5 h-4.5" />
          </div>
          {(searchQuery || data.productCode) && (
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 px-1"
              onClick={() => {
                setSearchQuery('');
                onChange({ productCode: '' });
                setShowDropdown(true);
              }}
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Floating Dropdown Suggestion List */}
        {showDropdown && (
          <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  id={`prod-item-${p.code}`}
                  className="w-full text-left p-3 hover:bg-slate-50 transition flex flex-col gap-0.5"
                  onClick={() => handleSelectProduct(p)}
                >
                  <span className="text-sm font-bold text-slate-800">{p.code}</span>
                  <span className="text-xs text-slate-500 flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-semibold text-success-700 bg-success-50 px-1.5 py-0.5 rounded">
                      Định mức: {p.normWeight} kg/cuộn
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-slate-400 font-medium">
                Không tìm thấy mã nào tương xứng
              </div>
            )}
          </div>
        )}

        {/* Quick Selection badges for the busy workers */}
        <div className="flex flex-wrap gap-2 pt-1">
          {STANDARD_PRODUCTS.slice(0, 4).map((p) => {
            const isSelected = data.productCode === p.code;
            return (
              <button
                key={p.code}
                type="button"
                id={`badge-prod-${p.code}`}
                onClick={() => handleSelectProduct(p)}
                className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition ${
                  isSelected
                    ? 'bg-success-600 border-success-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
                style={{ minHeight: '32px' }}
              >
                {p.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Production Quantities */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
        {/* Số Lượng Cuộn */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5" htmlFor="rolls">
            <ClipboardList className="w-4 h-4 text-slate-400" />
            Số Lượng Cuộn Đạt <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              id="rolls"
              min="0"
              step="1"
              value={data.rolls || ''}
              className="w-full h-12 px-3.5 pr-12 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 text-slate-800 text-base font-bold transition"
              placeholder="0"
              onChange={(e) => {
                const val = parseInt(e.target.value);
                onChange({ rolls: isNaN(val) ? 0 : val });
              }}
              style={{ minHeight: '44px' }}
            />
            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-sm font-semibold text-slate-400">
              cuộn
            </div>
          </div>
        </div>

        {/* Trọng Lượng Thành Phẩm Thực Tế */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5" htmlFor="actualWeight">
            <Scale className="w-4 h-4 text-slate-400" />
            Cân Nặng Thực Tế <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              id="actualWeight"
              min="0"
              step="0.1"
              value={data.actualWeight || ''}
              className="w-full h-12 px-3.5 pr-12 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-success-500/20 focus:border-success-500 text-slate-800 text-base font-bold transition"
              placeholder="0.0"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChange({ actualWeight: isNaN(val) ? 0 : val });
              }}
              style={{ minHeight: '44px' }}
            />
            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-sm font-semibold text-slate-400">
              kg
            </div>
          </div>
        </div>
      </div>

      {/* Automatic Norm Weights Calculation Display */}
      {selectedProduct && (
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/50 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-warning-500" />
            Tính toán định mức tự động
          </div>
          
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-200/80">
            <div>
              <p className="text-xs text-slate-500 font-medium h-4">Định mức/cuộn</p>
              <p className="text-base font-bold text-slate-700 mt-0.5">
                {formatNumber(normWeightPerRoll)} <span className="text-xs font-semibold text-slate-500">kg/cuộn</span>
              </p>
            </div>
            <div className="pl-4">
              <p className="text-xs text-slate-500 font-medium h-4">Tổng định mức Dự kiến (Theoretical)</p>
              <p id="calc-theoretical-weight" className="text-base font-bold text-slate-700 mt-0.5">
                {formatNumber(theoreticalTotalWeight)} <span className="text-xs font-semibold text-slate-500">kg</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 leading-relaxed font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Cân nặng thực tế nhập vào sẽ được đối chiếu với lượng bột nhựa phối trộn ở Bước tiếp theo để tính tỉ lệ hao hụt dây chuyền đùn nhựa.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
