import React from 'react';
import { MaterialBatches, MATERIAL_LABELS } from '../types';
import { Scale, Plus, Trash2, HelpCircle, Layers } from 'lucide-react';
import { sumArray, formatNumber } from '../utils';

interface MaterialsFormProps {
  data: MaterialBatches;
  onChange: (updated: Partial<MaterialBatches>) => void;
}

export default function MaterialsForm({ data, onChange }: MaterialsFormProps) {
  // Sum each material
  const totals = {
    virginPlastic: sumArray(data.virginPlastic),
    recycledPlastic: sumArray(data.recycledPlastic),
    brightenerPowder: sumArray(data.brightenerPowder),
    dispersionOil: sumArray(data.dispersionOil),
    otherAdditives: sumArray(data.otherAdditives),
  };

  // Total plastic = Virgin + Recycled
  const totalPlastic = totals.virginPlastic + totals.recycledPlastic;
  
  // Percentages relative to total plastic
  const virginPercent = totalPlastic > 0 ? (totals.virginPlastic / totalPlastic) * 100 : 0;
  const recycledPercent = totalPlastic > 0 ? (totals.recycledPlastic / totalPlastic) * 100 : 0;

  // Add a batch run to a specific material
  const handleAddBatch = (key: keyof MaterialBatches) => {
    const currentBatches = [...(data[key] || [0])];
    currentBatches.push(0);
    onChange({ [key]: currentBatches });
  };

  // Modify a batch run weight
  const handleUpdateBatch = (key: keyof MaterialBatches, index: number, value: number) => {
    const currentBatches = [...(data[key] || [0])];
    currentBatches[index] = value;
    onChange({ [key]: currentBatches });
  };

  // Remove a batch run
  const handleRemoveBatch = (key: keyof MaterialBatches, index: number) => {
    const currentBatches = [...(data[key] || [0])];
    if (currentBatches.length > 1) {
      currentBatches.splice(index, 1);
    } else {
      currentBatches[0] = 0; // reset single item
    }
    onChange({ [key]: currentBatches });
  };

  return (
    <div className="space-y-6" id="materials-entry-section">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          Vật Tư & Phối Trộn
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">Nhập lượng nguyên liệu nạp vào máy trực tiếp qua từng lần xúc (Mẻ / Batch)</p>
      </div>

      {/* Real-time Plastic Proportions Widget */}
      <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tỷ Lệ Nhựa Phối Phân Trực Quan</span>
          <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
            Tổng Plastic: {formatNumber(totalPlastic)} kg
          </span>
        </div>
        
        {/* Progress Bar proportion */}
        <div className="h-4.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
          {totalPlastic > 0 ? (
            <>
              <div 
                id="bar-virgin-plastic"
                className="bg-emerald-500 transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-slate-950"
                style={{ width: `${virginPercent}%` }}
                title={`Virgin: ${formatNumber(virginPercent, 1)}%`}
              >
                {virginPercent >= 15 ? `${formatNumber(virginPercent, 0)}%` : ''}
              </div>
              <div 
                id="bar-recycled-plastic"
                className="bg-amber-400 transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-slate-950"
                style={{ width: `${recycledPercent}%` }}
                title={`Recycled: ${formatNumber(recycledPercent, 1)}%`}
              >
                {recycledPercent >= 15 ? `${formatNumber(recycledPercent, 0)}%` : ''}
              </div>
            </>
          ) : (
            <div className="w-full text-slate-500 flex items-center justify-center text-[11px] font-medium italic">
              Chưa nhập định lượng nhựa phối
            </div>
          )}
        </div>

        {/* Labels for proportion bar */}
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold pt-1 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
            <span className="text-slate-300">Nguyên sinh:</span>
            <span className="font-mono text-[13px] text-emerald-400 ml-auto">{formatNumber(virginPercent)}%</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
            <span className="text-slate-300">Tái sinh/trộn:</span>
            <span className="font-mono text-[13px] text-amber-300 ml-auto">{formatNumber(recycledPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Accordion List for each raw material */}
      <div className="space-y-4">
        {(Object.keys(MATERIAL_LABELS) as Array<keyof MaterialBatches>).map((key) => {
          const config = MATERIAL_LABELS[key];
          const batches = data[key] || [0];
          const totalWeight = totals[key];
          const isPlastic = config.isPlastic;
          const proportionText = isPlastic && totalPlastic > 0 
            ? `${formatNumber(key === 'virginPlastic' ? virginPercent : recycledPercent)}% nhựa`
            : '';

          return (
            <div key={key} className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{config.label}</h4>
                  {isPlastic && totalPlastic > 0 ? (
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded">
                      Trọng số: {proportionText}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Phụ gia phối tỉ lệ vi lượng</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block uppercase font-medium h-4">Cộng dồn</span>
                  <span className="text-base font-extrabold text-slate-800">
                    {formatNumber(totalWeight)} <span className="text-xs font-semibold text-slate-500">{config.unit}</span>
                  </span>
                </div>
              </div>

              {/* Batches Table List */}
              <div className="space-y-2 pt-1">
                {batches.map((batchVal, bIndex) => (
                  <div key={bIndex} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 px-2 py-1.5 rounded-lg shrink-0 min-w-[50px] text-center">
                      Lần {bIndex + 1}
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-full h-11 px-3 pr-10 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-800 font-bold text-sm transition"
                        placeholder="0.0"
                        value={batchVal || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdateBatch(key, bIndex, isNaN(val) ? 0 : val);
                        }}
                        style={{ minHeight: '44px' }}
                      />
                      <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-xs text-slate-400">
                        {config.unit}
                      </div>
                    </div>
                    
                    {/* Delete dynamic batch */}
                    <button
                      type="button"
                      disabled={batches.length === 1 && batchVal === 0}
                      onClick={() => handleRemoveBatch(key, bIndex)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center border border-slate-100 hover:border-rose-100 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition shrink-0 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
                      style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Plus add run layout button */}
              <button
                type="button"
                className="w-full h-10 border border-dashed border-slate-200 hover:border-emerald-500 text-slate-500 hover:text-emerald-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-emerald-50/20 transition-all"
                onClick={() => handleAddBatch(key)}
                style={{ minHeight: '44px' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm lần cân nạp ({config.label})
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
