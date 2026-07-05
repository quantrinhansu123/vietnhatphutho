import React from 'react';
import { Trash2, FileText, AlertTriangle, MessageSquareCode } from 'lucide-react';

interface WasteFormProps {
  wasteWeight: number;
  notes: string;
  onChange: (updates: { wasteWeight?: number; notes?: string }) => void;
}

export default function WasteForm({ wasteWeight, notes, onChange }: WasteFormProps) {
  return (
    <div className="form-section" id="waste-entry-section">
      <h3 className="form-header">
        <Trash2 className="w-4 h-4 text-accent-700" />
        Phế phẩm & nhật ký ca trực
      </h3>

      {/* Khối Lượng Phế Phẩm */}
      <div className="space-y-2 bg-danger-50/30 border border-danger-100 p-2.5 rounded-md">
        <div className="space-y-1">
          <label className="field-label" htmlFor="wasteWeight">
            <Trash2 className="w-3 h-3 text-danger-500" />
            Khối lượng phế phẩm <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              id="wasteWeight"
              min="0"
              step="0.1"
              value={wasteWeight || ''}
              className="field-input pr-9 num font-semibold text-[14px] border-danger-200 focus:border-danger-500 focus:ring-danger-500/20"
              placeholder="0.0"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChange({ wasteWeight: isNaN(val) ? 0 : val });
              }}
            />
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-[11px] font-semibold text-danger-500">
              kg
            </div>
          </div>
          <p className="field-helper">
            Nhựa cháy đầu đùn, biên cắt bọc hỏng, cuộn bavia thừa, nổ bong bóng khí khi sấy đùi…
          </p>
        </div>

        {wasteWeight > 10 && (
          <div className="p-2 bg-warning-50 rounded-md border border-warning-200/60 flex gap-1.5 text-[11px] text-warning-800 font-medium leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 text-warning-500 shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">Cảnh báo phế phẩm cao:</strong> Vượt 10kg ảnh hưởng định mức phân xưởng. Hãy ghi rõ nguyên nhân ở khung ghi chú bên dưới!
            </span>
          </div>
        )}
      </div>

      {/* Nhật Ký Ca Máy / Ghi Chú */}
      <div className="space-y-1">
        <label className="field-label" htmlFor="notes">
          <FileText className="w-3 h-3 text-ink-400" />
          Nhật ký ca / ghi chú chi tiết
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={400}
          className="w-full p-2.5 bg-ink-50 focus:bg-white border border-ink-200 rounded-md focus:outline-none focus:border-accent-700 focus:ring-2 focus:ring-accent-700/20 text-ink-900 text-[13px] font-medium transition placeholder:text-ink-400 placeholder:italic leading-relaxed resize-none"
          placeholder="Ví dụ: Thay lưới lọc ở đầu ca trực lúc 10h. Máy chạy êm. Khổ PE mỏng kéo phồng bọc tốt..."
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
        <div className="flex justify-between items-center text-[10px] font-mono text-ink-400 pt-0.5">
          <span className="flex items-center gap-1">
            <MessageSquareCode className="w-3 h-3" />
            Vận hành viên hỗ trợ ghi tiếng Việt rõ chữ
          </span>
          <span className="num">{notes.length}/400</span>
        </div>
      </div>
    </div>
  );
}