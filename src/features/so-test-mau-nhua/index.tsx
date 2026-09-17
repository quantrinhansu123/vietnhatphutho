import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { useTabAccess } from '../../app/useTabAccess';
import { normalizeMaterialsInventory } from '../kho-nvl';
import { SoTronDatePicker, formatNgayVN } from '../so-tron/SoTronDatePicker';
import {
  emptyPlasticTestRow,
  hasPlasticTestContent,
  isPlasticTestMaterial,
  MAX_PLASTIC_TEST_ROWS,
  normalizePlasticTestDate,
  type PlasticTestRecord,
  type PlasticTestRow
} from './model';
import { printSoTestMauNhua } from './print';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400';
const cardClass = 'rounded-xl border border-slate-200 bg-white shadow-card';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

interface RowState extends PlasticTestRow {
  key: string;
}

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  phanLoai: string;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayLocal(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function toRowState(row: PlasticTestRow): RowState {
  return { ...emptyPlasticTestRow(), ...row, key: uid() };
}

function normalizeRecord(raw: unknown): PlasticTestRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  const ngay = normalizePlasticTestDate(String(r.ngay ?? '').slice(0, 10));
  if (!id || !ngay) return null;
  const list = Array.isArray(r.chi_tiet) ? r.chi_tiet : [];
  const chi_tiet: PlasticTestRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const line = item as Record<string, unknown>;
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    chi_tiet.push({
      material_id: str(line.material_id).trim(),
      ma_npl: str(line.ma_npl).trim(),
      ten_npl: str(line.ten_npl).trim(),
      may_ep_mau: str(line.may_ep_mau).trim(),
      may_va_dap: str(line.may_va_dap).trim(),
      chi_so_mi: str(line.chi_so_mi).trim(),
      ket_luan: str(line.ket_luan).trim(),
      nguoi_thuc_hien: str(line.nguoi_thuc_hien).trim()
    });
  }
  return { id, ngay, chi_tiet, updated_at: String(r.updated_at ?? '') };
}

export function SoTestMauNhuaWorkspace({ onBack }: { onBack?: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('so-test-mau-nhua');

  const [ngay, setNgay] = useState(todayLocal());
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [rows, setRows] = useState<RowState[]>([toRowState(emptyPlasticTestRow())]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [dirty, setDirty] = useState(false);

  const editable = recordId ? canEdit : canCreate;
  const canSave = recordId ? canEdit : canCreate;

  const loadMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    try {
      const res = await fetch('/api/kho-nvl');
      const data = await res.json().catch(() => ({}));
      const list = normalizeMaterialsInventory(data);
      const mapped: MaterialOption[] = list
        .filter(m => m.code || m.name)
        .map(m => ({ id: m.id, code: m.code, name: m.name, phanLoai: m.phanLoai }));
      // Loại hàng chỉ lấy NVL chính + NVL phụ; nếu kho chưa phân loại thì fallback toàn bộ để không trắng màn hình.
      const filtered = mapped.filter(m => isPlasticTestMaterial(m.phanLoai));
      setMaterials(filtered.length > 0 ? filtered : mapped);
    } catch {
      setMaterials([]);
    } finally {
      setMaterialsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const loadRecord = useCallback(async (date: string) => {
    const valid = normalizePlasticTestDate(date);
    if (!valid) return;
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/so-test-mau-nhua?ngay=${encodeURIComponent(valid)}&limit=2`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || 'Không thể tải sổ test.'));
      const records = Array.isArray(data?.records) ? data.records : [];
      const record = records.length > 0 ? normalizeRecord(records[0]) : null;
      if (record) {
        setRecordId(record.id);
        setRows(record.chi_tiet.length > 0 ? record.chi_tiet.map(toRowState) : [toRowState(emptyPlasticTestRow())]);
      } else {
        setRecordId(null);
        setRows([toRowState(emptyPlasticTestRow())]);
      }
      setDirty(false);
    } catch (err: unknown) {
      setRecordId(null);
      setRows([toRowState(emptyPlasticTestRow())]);
      setDirty(false);
      setMessage({ text: err instanceof Error ? err.message : 'Lỗi khi tải sổ test.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Chọn ngày thì tự động render: có sổ cũ fill sẵn, chưa có thì lưới trắng để thêm mới.
  useEffect(() => {
    if (!ngay) return;
    void loadRecord(ngay);
  }, [ngay, loadRecord]);

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  const updateCell = (key: string, field: keyof PlasticTestRow, value: string) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const selectMaterial = (key: string, materialId: string) => {
    const m = materialById.get(materialId) ?? null;
    setRows(prev =>
      prev.map(r =>
        r.key === key
          ? { ...r, material_id: materialId, ma_npl: m?.code ?? '', ten_npl: m?.name ?? '' }
          : r
      )
    );
    setDirty(true);
  };

  const addRow = () => {
    setRows(prev => (prev.length >= MAX_PLASTIC_TEST_ROWS ? prev : [...prev, toRowState(emptyPlasticTestRow())]));
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows(prev => {
      const next = prev.filter(r => r.key !== key);
      return next.length > 0 ? next : [toRowState(emptyPlasticTestRow())];
    });
    setDirty(true);
  };

  const buildPayload = (): { ok: true; chi_tiet: PlasticTestRow[] } | { ok: false; error: string } => {
    const chi_tiet: PlasticTestRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!hasPlasticTestContent(r)) continue;
      if (!r.material_id) return { ok: false, error: `Dòng ${i + 1}: vui lòng chọn loại hàng từ kho nguyên vật liệu.` };
      const m = materialById.get(r.material_id) ?? null;
      chi_tiet.push({
        material_id: r.material_id,
        ma_npl: (m?.code || r.ma_npl).trim(),
        ten_npl: (m?.name || r.ten_npl).trim(),
        may_ep_mau: r.may_ep_mau.trim(),
        may_va_dap: r.may_va_dap.trim(),
        chi_so_mi: r.chi_so_mi.trim(),
        ket_luan: r.ket_luan.trim(),
        nguoi_thuc_hien: r.nguoi_thuc_hien.trim()
      });
    }
    return { ok: true, chi_tiet };
  };

  const save = async () => {
    const valid = normalizePlasticTestDate(ngay);
    if (!valid) {
      setMessage({ text: 'Ngày không hợp lệ.', type: 'error' });
      return;
    }
    const payload = buildPayload();
    if (!payload.ok) {
      const err = (payload as { ok: false; error: string }).error;
      setMessage({ text: err, type: 'error' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const body = JSON.stringify({ ngay: valid, chi_tiet: payload.chi_tiet });
      let res: Response;
      let data: Record<string, unknown>;
      if (recordId) {
        res = await fetch(`/api/so-test-mau-nhua/${encodeURIComponent(recordId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data?.error || 'Không thể lưu sổ test.'));
      } else {
        res = await fetch('/api/so-test-mau-nhua', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.status === 409) {
          // Ngày đã có sổ (do trùng unique) → tải về rồi cập nhật.
          const re = await fetch(`/api/so-test-mau-nhua?ngay=${encodeURIComponent(valid)}&limit=2`);
          const rej = (await re.json().catch(() => ({}))) as Record<string, unknown>;
          const list = Array.isArray(rej?.records) ? (rej.records as unknown[]) : [];
          const existing = list.length > 0 ? normalizeRecord(list[0]) : null;
          if (!existing) throw new Error(String(data?.error || 'Đã tồn tại sổ ngày này.'));
          const putRes = await fetch(`/api/so-test-mau-nhua/${encodeURIComponent(existing.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body
          });
          const putData = (await putRes.json().catch(() => ({}))) as Record<string, unknown>;
          if (!putRes.ok) throw new Error(String(putData?.error || 'Không thể lưu sổ test.'));
          data = putData;
        } else if (!res.ok) {
          throw new Error(String(data?.error || 'Không thể lưu sổ test.'));
        }
      }
      const saved = normalizeRecord(data?.record);
      if (saved) {
        setRecordId(saved.id);
        setRows(saved.chi_tiet.length > 0 ? saved.chi_tiet.map(toRowState) : [toRowState(emptyPlasticTestRow())]);
      } else {
        await loadRecord(valid);
      }
      setDirty(false);
      setMessage({ text: 'Đã lưu sổ test mẫu nhựa.', type: 'success' });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Lỗi khi lưu sổ.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const removeBook = async () => {
    if (!recordId) return;
    if (!window.confirm(`Xóa toàn bộ sổ test ngày ${formatNgayVN(ngay)}?`)) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/so-test-mau-nhua/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data?.error || 'Không thể xóa sổ test.'));
      setRecordId(null);
      setRows([toRowState(emptyPlasticTestRow())]);
      setDirty(false);
      setMessage({ text: 'Đã xóa sổ test mẫu nhựa.', type: 'success' });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Lỗi khi xóa sổ.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const payload = buildPayload();
    const chi_tiet = payload.ok ? payload.chi_tiet : rows;
    printSoTestMauNhua(ngay, chi_tiet);
  };

  const statusText = isLoading
    ? 'Đang tải...'
    : recordId
      ? dirty
        ? 'Đã có sổ — đang sửa'
        : 'Đã có sổ'
      : dirty
        ? 'Sổ mới — đang nhập'
        : 'Sổ mới (chưa lưu)';

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          {onBack && <BackButton onClick={onBack} />}
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-semibold tracking-tight text-slate-900">
              Sổ test mẫu nhựa
            </h2>
            <p className="text-[12px] font-semibold text-slate-500">
              QC · {formatNgayVN(ngay) || 'Chưa chọn ngày'} · {statusText} · Loại hàng từ kho NVL (chính + phụ)
            </p>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void loadRecord(ngay)}
            disabled={isLoading || !ngay}
            title="Tải lại sổ theo ngày đang chọn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Tải lại
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isLoading || !ngay}
            title="In sổ test mẫu nhựa theo mẫu giấy"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" /> In
          </button>
          {canDelete && recordId && (
            <button
              type="button"
              onClick={() => void removeBook()}
              disabled={isSaving}
              title="Xóa toàn bộ sổ ngày đang chọn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa sổ
            </button>
          )}
          {canSave && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || isLoading || !editable}
              title={recordId ? 'Cập nhật sổ ngày đang chọn' : 'Lưu sổ mới cho ngày đang chọn'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? 'Đang lưu...' : recordId ? 'Lưu sửa' : 'Lưu sổ'}
            </button>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[240px_1fr]">
          <div>
            <span className={labelClass}>Ngày test</span>
            <SoTronDatePicker value={ngay} onChange={setNgay} placeholder="Chọn ngày test" />
          </div>
          <div className="flex items-end">
            {message && (
              <p
                className={`w-full rounded-lg px-3 py-2 text-[12.5px] font-bold ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </p>
            )}
          </div>
        </div>
        {!editable && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
            Tài khoản chỉ được xem sổ test mẫu nhựa (thiếu quyền thêm/sửa).
          </p>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th rowSpan={2} className="w-10 border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  STT
                </th>
                <th rowSpan={2} className="w-24 border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Ngày tháng
                </th>
                <th rowSpan={2} className="min-w-[220px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Loại Hàng
                </th>
                <th colSpan={3} className="border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Chỉ Số Test
                </th>
                <th rowSpan={2} className="min-w-[130px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Kết Luận
                </th>
                <th rowSpan={2} className="min-w-[140px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Người Thực Hiện
                </th>
                <th rowSpan={2} className="w-12 border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Xóa
                </th>
              </tr>
              <tr className="bg-slate-50">
                <th className="min-w-[130px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Máy Ép Mẫu
                </th>
                <th className="min-w-[130px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Máy Va Đập
                </th>
                <th className="min-w-[130px] border border-slate-200 px-2 py-2 text-center text-[12px] font-bold text-slate-700">
                  Chỉ Số MFI
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.key} className="align-top odd:bg-white even:bg-slate-50/50">
                  <td className="border border-slate-200 px-2 py-1.5 text-center text-[13px] font-bold tabular-nums text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center text-[13px] font-bold tabular-nums text-slate-700">
                    {formatNgayVN(ngay)}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <SearchableSelect
                      value={r.material_id}
                      onChange={v => selectMaterial(r.key, v)}
                      options={materials}
                      placeholder={materialsLoading ? 'Đang tải kho NVL...' : 'Chọn loại hàng'}
                      isLoading={materialsLoading}
                      disabled={!editable || isLoading}
                      getLabel={(item: unknown) => {
                        const m = item as MaterialOption;
                        return `${m.code} - ${m.name}`;
                      }}
                      getValue={(item: unknown) => (item as MaterialOption).id}
                      getSearchText={(item: unknown) => {
                        const m = item as MaterialOption;
                        return `${m.code} ${m.name}`;
                      }}
                      inputClassName={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <input
                      value={r.may_ep_mau}
                      onChange={e => updateCell(r.key, 'may_ep_mau', e.target.value)}
                      disabled={!editable}
                      placeholder="Máy ép mẫu"
                      className={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <input
                      value={r.may_va_dap}
                      onChange={e => updateCell(r.key, 'may_va_dap', e.target.value)}
                      disabled={!editable}
                      placeholder="Máy va đập"
                      className={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <input
                      value={r.chi_so_mi}
                      onChange={e => updateCell(r.key, 'chi_so_mi', e.target.value)}
                      disabled={!editable}
                      placeholder="Chỉ số MFI"
                      className={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <input
                      value={r.ket_luan}
                      onChange={e => updateCell(r.key, 'ket_luan', e.target.value)}
                      disabled={!editable}
                      placeholder="Kết luận"
                      className={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5">
                    <input
                      value={r.nguoi_thuc_hien}
                      onChange={e => updateCell(r.key, 'nguoi_thuc_hien', e.target.value)}
                      disabled={!editable}
                      placeholder="Người thực hiện"
                      className={inputClass}
                    />
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      disabled={!editable || (rows.length <= 1 && !hasPlasticTestContent(r))}
                      title={`Xóa dòng ${idx + 1}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2.5">
          <span className="text-xs font-bold text-slate-500">
            {rows.length}/{MAX_PLASTIC_TEST_ROWS} dòng · Ngày {formatNgayVN(ngay)}
          </span>
          <span className="flex-1" />
          {editable && (
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= MAX_PLASTIC_TEST_ROWS}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm dòng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
