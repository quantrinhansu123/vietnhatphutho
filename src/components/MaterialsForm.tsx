import React from 'react';
import { MaterialBatches, MATERIAL_LABELS } from '../types';
import { Scale, Plus, Trash2, Layers } from 'lucide-react';
import { sumArray, formatNumber } from '../utils';

interface MaterialsFormProps {
  data: MaterialBatches;
  onChange: (updated: Partial<MaterialBatches>) => void;
}

export default function MaterialsForm({ data, onChange }: MaterialsFormProps) {
  const totals = {
    virginPlastic: sumArray(data.virginPlastic),
    recycledPlastic: sumArray(data.recycledPlastic),
    brightenerPowder: sumArray(data.brightenerPowder),
    dispersionOil: sumArray(data.dispersionOil),
    otherAdditives: sumArray(data.otherAdditives),
  };

  const totalPlastic = totals.virginPlastic + totals.recycledPlastic;

  const virginPercent = totalPlastic > 0 ? (totals.virginPlastic / totalPlastic) * 100 : 0;
  const recycledPercent = totalPlastic > 0 ? (totals.recycledPlastic / totalPlastic) * 100 : 0;

  const handleAddBatch = (key: keyof MaterialBatches) => {
    const currentBatches = [...(data[key] || [0])];
    currentBatches.push(0);
    onChange({ [key]: currentBatches });
  };

  const handleUpdateBatch = (key: keyof MaterialBatches, index: number, value: number) => {
    const currentBatches = [...(data[key] || [0])];
    currentBatches[index] = value;
    onChange({ [key]: currentBatches });
  };

  const handleRemoveBatch = (key: keyof MaterialBatches, index: number) => {
    const currentBatches = [...(data[key] || [0])];
    if (currentBatches.length > 1) {
      currentBatches.splice(index, 1);
    } else {
      currentBatches[0] = 0;
    }
    onChange({ [key]: currentBatches });
  };

  return (
    <div className="form-section" id="materials-entry-section">
      <h3 className="form-header">
        <Layers className="w-4 h-4 text-accent-700" />
        Vật tư & phối trộn
      </h3>

      {/* Real-time Plastic Proportions Widget */}
      <div className="rounded-md bg-ink-900 border border-ink-800 p-2.5 space-y-2 text-ink-100">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-400">Tỷ lệ nhựa phối</span>
          <span className="pill num bg-accent-500/20 text-accent-300">
            Tổng {formatNumber(totalPlastic)} kg
          </span>
        </div>

        {/* Progress Bar proportion */}
        <div className="h-3 w-full bg-ink-800 rounded-full overflow-hidden flex">
          {totalPlastic > 0 ? (
            <>
              <div
                id="bar-virgin-plastic"
                className="bg-accent-500 transition-all duration-300 flex items-center justify-center text-[9px] font-extrabold text-ink-950 num"
                style={{ width: `${virginPercent}%` }}
                title={`Virgin: ${virginPercent.toFixed(1)}%`}
              >
                {virginPercent >= 15 ? `${virginPercent.toFixed(0)}%` : ''}
              </div>
              <div
                id="bar-recycled-plastic"
                className="bg-warning-400 transition-all duration-300 flex items-center justify-center text-[9px] font-extrabold text-ink-950 num"
                style={{ width: `${recycledPercent}%` }}
                title={`Recycled: ${recycledPercent.toFixed(1)}%`}
              >
                {recycledPercent >= 15 ? `${recycledPercent.toFixed(0)}%` : ''}
              </div>
            </>
          ) : (
            <div className="w-full text-ink-500 flex items-center justify-center text-[10px] italic">
              Chưa nhập định lượng nhựa phối
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold pt-1 border-t border-ink-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-500 block" />
            <span className="text-ink-300">Nguyên sinh:</span>
            <span className="num text-[12px] text-accent-300 ml-auto">{formatNumber(virginPercent)}%</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-ink-800 pl-2">
            <span className="w-2 h-2 rounded-full bg-warning-400 block" />
            <span className="text-ink-300">Tái sinh:</span>
            <span className="num text-[12px] text-warning-300 ml-auto">{formatNumber(recycledPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Accordion List for each raw material */}
      <div className="space-y-2.5">
        {(Object.keys(MATERIAL_LABELS) as Array<keyof MaterialBatches>).map((key) => {
          const config = MATERIAL_LABELS[key];
          const batches = data[key] || [0];
          const totalWeight = totals[key];
          const isPlastic = config.isPlastic;
          const proportionText = isPlastic && totalPlastic > 0
            ? `${formatNumber(key === 'virginPlastic' ? virginPercent : recycledPercent)}% nhựa`
            : '';

          return (
            <div key={key} className="p-2.5 bg-white rounded-md border border-ink-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-[13px] font-semibold text-ink-900">{config.label}</h4>
                  {isPlastic && totalPlastic > 0 ? (
                    <span className="pill bg-ink-100 text-ink-500 mt-0.5 inline-block">
                      {proportionText}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase text-ink-400 italic">Phụ gia vi lượng</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="block uppercase font-mono text-[9px] text-ink-400">Cộng dồn</span>
                  <span className="num text-[14px] font-bold text-ink-900">
                    {formatNumber(totalWeight)} <span className="text-[10px] font-semibold text-ink-500">{config.unit}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-0.5">
                {batches.map((batchVal, bIndex) => (
                  <div key={bIndex} className="flex items-center gap-1.5">
                    <span className="num text-[10px] font-semibold text-ink-500 bg-ink-100 px-1.5 py-1 rounded shrink-0 min-w-[44px] text-center">
                      Lần {bIndex + 1}
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="field-input pr-8 num font-semibold"
                        placeholder="0.0"
                        value={batchVal || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdateBatch(key, bIndex, isNaN(val) ? 0 : val);
                        }}
                      />
                      <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[10px] font-semibold text-ink-400">
                        {config.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={batches.length === 1 && batchVal === 0}
                      onClick={() => handleRemoveBatch(key, bIndex)}
                      className="w-9 h-9 rounded-md flex items-center justify-center border border-ink-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-ink-400 hover:text-rose-600 transition shrink-0 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-ink-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="w-full h-8 border border-dashed border-ink-200 hover:border-accent-700 text-ink-500 hover:text-accent-700 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold hover:bg-accent-50/30 transition"
                onClick={() => handleAddBatch(key)}
              >
                <Plus className="w-3 h-3" />
                Thêm lần cân nạp
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}