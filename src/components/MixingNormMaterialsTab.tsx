import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { RowActionsMenu } from './shared/table';

export type MixingNormLine = {
  ma_nvl: string;
  ten_nvl: string;
  gia_tri: number | null;
  don_vi: string;
};

export type MixingNormRow = {
  id: string;
  ngay: string;
  tong_trong_luong: number | null;
  ghi_chu: string;
  chi_tiet: MixingNormLine[];
  created_at?: string;
};

type MaterialOption = {
  code: string;
  name: string;
  unit: string;
};

type LineForm = {
  key: string;
  maNvl: string;
  tenNvl: string;
  giaTri: string;
  donVi: 'kg' | '%';
};

type NormForm = {
  ngay: string;
  tongTrongLuong: string;
  ghiChu: string;
  lines: LineForm[];
};

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

const emptyLine = (): LineForm => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  maNvl: '',
  tenNvl: '',
  giaTri: '',
  donVi: 'kg'
});

const emptyForm = (): NormForm => ({
  ngay: new Date().toISOString().slice(0, 10),
  tongTrongLuong: '',
  ghiChu: '',
  lines: [emptyLine()]
});

function normalizeMaterials(data: unknown): MaterialOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { materials?: unknown }).materials)
      ? (data as { materials: unknown[] }).materials
      : [];

  const mapped = rows
    .map((item): MaterialOption | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const code = String(row.ma_npl ?? row.ma_nvl ?? row.code ?? '').trim();
      const name = String(row.ten_npl ?? row.ten_nvl ?? row.name ?? '').trim();
      if (!code && !name) return null;
      const unitRaw = String(row.don_vi ?? 'kg').trim();
      return {
        code,
        name,
        unit: unitRaw === '%' ? '%' : 'kg'
      };
    })
    .filter((item): item is MaterialOption => Boolean(item));

  const byCode = new Map<string, MaterialOption>();
  for (const item of mapped) {
    if (!item.code) continue;
    if (!byCode.has(item.code)) byCode.set(item.code, item);
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}

function parseNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeLines(raw: unknown): MixingNormLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): MixingNormLine | null => {
      if (!item || typeof item !== 'object') return null;
      const line = item as Record<string, unknown>;
      const ma_nvl = String(line.ma_nvl ?? '').trim();
      const ten_nvl = String(line.ten_nvl ?? '').trim();
      if (!ma_nvl && !ten_nvl) return null;
      return {
        ma_nvl,
        ten_nvl,
        gia_tri: parseNumberOrNull(line.gia_tri ?? line.dinh_muc),
        don_vi: String(line.don_vi ?? 'kg').trim() === '%' ? '%' : 'kg'
      };
    })
    .filter((line): line is MixingNormLine => Boolean(line));
}

function normalizeRows(data: unknown): MixingNormRow[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { records?: unknown }).records)
      ? (data as { records: unknown[] }).records
      : [];

  return rows
    .map((item): MixingNormRow | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      if (!id) return null;

      let chi_tiet = normalizeLines(row.chi_tiet);
      // Tương thích bản cũ: 1 dòng flat ma_nvl/ten_nvl/dinh_muc
      if (chi_tiet.length === 0) {
        const ma = String(row.ma_nvl ?? '').trim();
        const ten = String(row.ten_nvl ?? '').trim();
        if (ma || ten) {
          chi_tiet = [
            {
              ma_nvl: ma,
              ten_nvl: ten,
              gia_tri: parseNumberOrNull(row.dinh_muc),
              don_vi: String(row.don_vi_dinh_muc ?? 'kg').trim() === '%' ? '%' : 'kg'
            }
          ];
        }
      }

      return {
        id,
        ngay: String(row.ngay ?? '').trim(),
        tong_trong_luong: parseNumberOrNull(row.tong_trong_luong),
        ghi_chu: String(row.ghi_chu ?? '').trim(),
        chi_tiet,
        created_at: row.created_at ? String(row.created_at) : undefined
      };
    })
    .filter((row): row is MixingNormRow => Boolean(row));
}

function summarizeLines(lines: MixingNormLine[]) {
  if (lines.length === 0) return 'Chưa có NVL';
  return lines
    .map(line => {
      const name = line.ten_nvl || line.ma_nvl || 'NVL';
      const value =
        line.gia_tri === null || line.gia_tri === undefined ? '—' : `${line.gia_tri}${line.don_vi || ''}`;
      return `${name}: ${value}`;
    })
    .join(' · ');
}

export default function MixingNormMaterialsTab() {
  const [rows, setRows] = useState<MixingNormRow[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<NormForm>(emptyForm);

  const materialsByCode = useMemo(() => {
    const map = new Map<string, MaterialOption>();
    for (const item of materials) map.set(item.code, item);
    return map;
  }, [materials]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bang-tron-vat-tu-dinh-muc');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không tải được bảng định mức.');
      setRows(normalizeRows(data));
    } catch (err: any) {
      setRows([]);
      setError(err?.message || 'Không tải được bảng định mức.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/kho-nvl');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không tải được kho NVL.');
      setMaterials(normalizeMaterials(data));
    } catch {
      setMaterials([]);
    }
  }, []);

  useEffect(() => {
    void loadRows();
    void loadMaterials();
  }, [loadRows, loadMaterials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      `${row.ngay} ${row.tong_trong_luong ?? ''} ${row.ghi_chu} ${summarizeLines(row.chi_tiet)}`
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm());
    setShowForm(true);
    setError('');
    setMessage('');
  };

  const openEdit = (row: MixingNormRow) => {
    setEditingId(row.id);
    setForm({
      ngay: row.ngay || new Date().toISOString().slice(0, 10),
      tongTrongLuong:
        row.tong_trong_luong === null || row.tong_trong_luong === undefined
          ? ''
          : String(row.tong_trong_luong),
      ghiChu: row.ghi_chu,
      lines:
        row.chi_tiet.length > 0
          ? row.chi_tiet.map(line => ({
              key: `${row.id}-${line.ma_nvl}-${Math.random().toString(36).slice(2, 6)}`,
              maNvl: line.ma_nvl,
              tenNvl: line.ten_nvl,
              giaTri: line.gia_tri === null || line.gia_tri === undefined ? '' : String(line.gia_tri),
              donVi: line.don_vi === '%' ? '%' : 'kg'
            }))
          : [emptyLine()]
    });
    setShowForm(true);
    setError('');
    setMessage('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId('');
    setForm(emptyForm());
  };

  const updateLine = (key: string, patch: Partial<LineForm>) => {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(line => (line.key === key ? { ...line, ...patch } : line))
    }));
  };

  const selectMaterialCode = (key: string, code: string) => {
    const material = materialsByCode.get(code);
    updateLine(key, {
      maNvl: code,
      tenNvl: material?.name ?? ''
    });
  };

  const addLine = () => {
    setForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const removeLine = (key: string) => {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.length <= 1 ? prev.lines : prev.lines.filter(line => line.key !== key)
    }));
  };

  const handleSave = async () => {
    const validLines = form.lines.filter(line => line.maNvl.trim() || line.tenNvl.trim());
    if (validLines.length === 0) {
      setError('Vui lòng thêm ít nhất 1 dòng NVL.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ngay: form.ngay.trim() || null,
        tong_trong_luong: form.tongTrongLuong.trim() === '' ? null : Number(form.tongTrongLuong.replace(',', '.')),
        ghi_chu: form.ghiChu.trim(),
        chi_tiet: validLines.map(line => ({
          ma_nvl: line.maNvl.trim(),
          ten_nvl: line.tenNvl.trim(),
          gia_tri: line.giaTri.trim() === '' ? null : Number(line.giaTri.replace(',', '.')),
          don_vi: line.donVi
        }))
      };
      if (payload.tong_trong_luong !== null && !Number.isFinite(payload.tong_trong_luong)) {
        throw new Error('Tổng trọng lượng phải là số.');
      }
      for (const [index, line] of payload.chi_tiet.entries()) {
        if (line.gia_tri !== null && !Number.isFinite(line.gia_tri)) {
          throw new Error(`Giá trị dòng NVL #${index + 1} không hợp lệ.`);
        }
      }

      const res = await fetch(
        editingId ? `/api/bang-tron-vat-tu-dinh-muc/${encodeURIComponent(editingId)}` : '/api/bang-tron-vat-tu-dinh-muc',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không lưu được phiếu định mức.');

      setMessage(editingId ? 'Đã cập nhật phiếu định mức.' : 'Đã thêm phiếu định mức.');
      closeForm();
      await loadRows();
    } catch (err: any) {
      setError(err?.message || 'Không lưu được phiếu định mức.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa phiếu định mức này?')) return;
    setDeletingId(id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/bang-tron-vat-tu-dinh-muc/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không xóa được phiếu định mức.');
      setMessage('Đã xóa phiếu định mức.');
      await loadRows();
    } catch (err: any) {
      setError(err?.message || 'Không xóa được phiếu định mức.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm ngày, NVL, ghi chú..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={openCreate}
          className="mt-3 flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] lg:mt-0"
        >
          <Plus className="h-4 w-4" />
          Thêm phiếu định mức
        </button>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          {message}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-black">Ngày</th>
                <th className="whitespace-nowrap px-3 py-3 font-black">Tổng trọng lượng</th>
                <th className="px-3 py-3 font-black">Dòng NVL / giá trị</th>
                <th className="whitespace-nowrap px-3 py-3 font-black">Ghi chú</th>
                <th className="whitespace-nowrap px-3 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-red-50/40">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-zinc-800">{row.ngay || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black text-[#ef1b2d]">
                    {row.tong_trong_luong === null || row.tong_trong_luong === undefined
                      ? '—'
                      : `${row.tong_trong_luong} kg`}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-zinc-700" title={summarizeLines(row.chi_tiet)}>
                    <div className="space-y-1">
                      {row.chi_tiet.length === 0 ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        row.chi_tiet.map((line, index) => (
                          <div key={`${row.id}-${index}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-mono text-zinc-500">{line.ma_nvl || '—'}</span>
                            <span>{line.ten_nvl || '—'}</span>
                            <span className="font-black text-[#ef1b2d]">
                              {line.gia_tri === null || line.gia_tri === undefined
                                ? '—'
                                : `${line.gia_tri} ${line.don_vi || 'kg'}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-zinc-500" title={row.ghi_chu}>
                    {row.ghi_chu || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <RowActionsMenu label={`Thao tác định mức ${row.ngay || row.id}`}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Xóa
                      </button>
                    </div>
                    </RowActionsMenu>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center font-bold text-zinc-500">
                    Chưa có phiếu định mức. Bấm “Thêm phiếu định mức” để nhập tay.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center font-bold text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải...
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                {editingId ? 'Sửa phiếu định mức' : 'Thêm phiếu định mức'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày</span>
                  <input
                    type="date"
                    value={form.ngay}
                    onChange={event => setForm(prev => ({ ...prev, ngay: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tổng trọng lượng (kg)</span>
                  <input
                    value={form.tongTrongLuong}
                    onChange={event => setForm(prev => ({ ...prev, tongTrongLuong: event.target.value }))}
                    className={inputClass}
                    placeholder="VD: 1000"
                    inputMode="decimal"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                  <input
                    value={form.ghiChu}
                    onChange={event => setForm(prev => ({ ...prev, ghiChu: event.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Dòng NVL</p>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm dòng NVL
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, index) => {
                    const codeInCatalog = Boolean(line.maNvl && materialsByCode.has(line.maNvl));
                    return (
                      <div
                        key={line.key}
                        className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 bg-white p-2.5 sm:grid-cols-[1fr_1.2fr_0.8fr_0.55fr_auto]"
                      >
                        <select
                          value={line.maNvl}
                          onChange={event => selectMaterialCode(line.key, event.target.value)}
                          className={inputClass}
                        >
                          <option value="">{`Chọn mã NVL #${index + 1}`}</option>
                          {line.maNvl && !codeInCatalog && (
                            <option value={line.maNvl}>{line.maNvl} (không còn trong kho)</option>
                          )}
                          {materials.map(material => (
                            <option key={material.code} value={material.code}>
                              {material.code}
                              {material.name ? ` — ${material.name}` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          value={line.tenNvl}
                          readOnly
                          className={`${inputClass} bg-zinc-50 text-zinc-600`}
                          placeholder="Tên NVL (tự điền)"
                          title="Tự điền theo mã NVL"
                        />
                        <input
                          value={line.giaTri}
                          onChange={event => updateLine(line.key, { giaTri: event.target.value })}
                          className={inputClass}
                          placeholder="Giá trị"
                          inputMode="decimal"
                        />
                        <select
                          value={line.donVi}
                          onChange={event =>
                            updateLine(line.key, { donVi: event.target.value === '%' ? '%' : 'kg' })
                          }
                          className={inputClass}
                        >
                          <option value="kg">kg</option>
                          <option value="%">%</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          disabled={form.lines.length <= 1}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          title="Xóa dòng"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
