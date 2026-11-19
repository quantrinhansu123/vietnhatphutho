import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Columns3,
  Table2
} from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';

type DataTableInfo = {
  name: string;
  estimatedRows: number;
  columnCount: number;
};

type DataColumnInfo = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  columnDefault: string | null;
  ordinalPosition: number;
  isPrimaryKey: boolean;
};

const COLUMN_TYPES = [
  'text',
  'uuid',
  'boolean',
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'date',
  'timestamptz',
  'jsonb'
] as const;

type Props = {
  onBack: () => void;
};

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export function DataAdminPanel({ onBack }: Props) {
  const { canView, canCreate, canEdit, canDelete } = useTabAccess('data');
  const [tables, setTables] = useState<DataTableInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [detailTab, setDetailTab] = useState<'columns' | 'rows'>('rows');
  const [columns, setColumns] = useState<DataColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [schemaSource, setSchemaSource] = useState<'postgres' | 'rest' | ''>('');
  const [ddlEnabled, setDdlEnabled] = useState(false);

  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCols, setNewTableCols] = useState([{ name: 'ten', type: 'text', nullable: true, primaryKey: false }]);

  const [addColOpen, setAddColOpen] = useState(false);
  const [addColName, setAddColName] = useState('');
  const [addColType, setAddColType] = useState<string>('text');
  const [addColNullable, setAddColNullable] = useState(true);

  const [editCol, setEditCol] = useState<DataColumnInfo | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColType, setEditColType] = useState('text');
  const [editColNullable, setEditColNullable] = useState(true);

  const [rowFormOpen, setRowFormOpen] = useState(false);
  const [rowDraft, setRowDraft] = useState<Record<string, string>>({});
  const [rowMatch, setRowMatch] = useState<Record<string, unknown> | null>(null);

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(table => table.name.toLowerCase().includes(q));
  }, [tables, query]);

  const pkColumns = useMemo(() => columns.filter(col => col.isPrimaryKey).map(col => col.name), [columns]);

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    setError('');
    try {
      const res = await fetch('/api/data/tables');
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không tải được danh sách bảng.');
      setTables(Array.isArray(data.tables) ? data.tables : []);
      const source = data.source === 'postgres' || data.source === 'rest' ? data.source : '';
      setSchemaSource(source);
      setDdlEnabled(Boolean(data.ddlEnabled));
    } catch (err: unknown) {
      setTables([]);
      setSchemaSource('');
      setDdlEnabled(false);
      setError(err instanceof Error ? err.message : 'Không tải được danh sách bảng.');
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const loadColumns = useCallback(async (table: string) => {
    const res = await fetch(`/api/data/tables/${encodeURIComponent(table)}/columns`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Không tải được cột.');
    setColumns(Array.isArray(data.columns) ? data.columns : []);
  }, []);

  const loadRows = useCallback(async (table: string, nextOffset = 0) => {
    const res = await fetch(
      `/api/data/tables/${encodeURIComponent(table)}/rows?limit=${limit}&offset=${nextOffset}`
    );
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Không tải được dữ liệu.');
    setRows(Array.isArray(data.rows) ? data.rows : []);
    setRowCount(Number(data.count || 0));
    setOffset(nextOffset);
  }, []);

  const loadDetail = useCallback(
    async (table: string) => {
      if (!table) return;
      setLoadingDetail(true);
      setError('');
      try {
        await loadColumns(table);
        if (detailTab === 'rows') await loadRows(table, 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không tải được chi tiết bảng.');
      } finally {
        setLoadingDetail(false);
      }
    },
    [detailTab, loadColumns, loadRows]
  );

  useEffect(() => {
    if (canView) void loadTables();
  }, [canView, loadTables]);

  useEffect(() => {
    if (selectedTable) void loadDetail(selectedTable);
  }, [selectedTable, detailTab, loadDetail]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
        Bạn không có quyền xem menu Data.
        <button type="button" onClick={onBack} className="mt-3 block text-xs underline">
          Quay lại
        </button>
      </div>
    );
  }

  const runAction = async (fn: () => Promise<void>, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
      await loadTables();
      if (selectedTable) await loadDetail(selectedTable);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTable = () =>
    runAction(async () => {
      const res = await fetch('/api/data/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTableName.trim(), columns: newTableCols })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không tạo được bảng.');
      setCreateTableOpen(false);
      setNewTableName('');
      setSelectedTable(newTableName.trim());
    }, `Đã tạo bảng ${newTableName.trim()}.`);

  const handleDropTable = () => {
    if (!selectedTable) return;
    const confirmName = window.prompt(`Gõ lại tên bảng "${selectedTable}" để xóa vĩnh viễn:`);
    if (!confirmName) return;
    void runAction(async () => {
      const res = await fetch(`/api/data/tables/${encodeURIComponent(selectedTable)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không xóa được bảng.');
      setSelectedTable('');
      setColumns([]);
      setRows([]);
    }, `Đã xóa bảng ${selectedTable}.`);
  };

  const handleAddColumn = () =>
    runAction(async () => {
      const res = await fetch(`/api/data/tables/${encodeURIComponent(selectedTable)}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addColName.trim(), type: addColType, nullable: addColNullable })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không thêm được cột.');
      setAddColOpen(false);
      setAddColName('');
    }, `Đã thêm cột ${addColName.trim()}.`);

  const handleSaveColumn = () => {
    if (!editCol || !selectedTable) return;
    void runAction(async () => {
      const res = await fetch(
        `/api/data/tables/${encodeURIComponent(selectedTable)}/columns/${encodeURIComponent(editCol.name)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newName: editColName.trim(),
            type: editColType,
            nullable: editColNullable
          })
        }
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không sửa được cột.');
      setEditCol(null);
    }, 'Đã cập nhật cột.');
  };

  const handleDropColumn = (column: string) => {
    const confirmName = window.prompt(`Gõ lại tên cột "${column}" để xóa:`);
    if (!confirmName) return;
    void runAction(async () => {
      const res = await fetch(
        `/api/data/tables/${encodeURIComponent(selectedTable)}/columns/${encodeURIComponent(column)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmName })
        }
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không xóa được cột.');
    }, `Đã xóa cột ${column}.`);
  };

  const openNewRow = () => {
    const draft: Record<string, string> = {};
    columns.forEach(col => {
      draft[col.name] = '';
    });
    setRowMatch(null);
    setRowDraft(draft);
    setRowFormOpen(true);
  };

  const openEditRow = (row: Record<string, unknown>) => {
    const draft: Record<string, string> = {};
    columns.forEach(col => {
      const value = row[col.name];
      draft[col.name] = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
    const match: Record<string, unknown> = {};
    const keys = pkColumns.length > 0 ? pkColumns : Object.keys(row).slice(0, 1);
    keys.forEach(key => {
      match[key] = row[key];
    });
    setRowMatch(match);
    setRowDraft(draft);
    setRowFormOpen(true);
  };

  const parseDraftValues = () => {
    const values: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(rowDraft)) {
      const text = raw.trim();
      if (text === '') continue;
      if (text === 'true') values[key] = true;
      else if (text === 'false') values[key] = false;
      else if (text === 'null') values[key] = null;
      else if (/^-?\d+(\.\d+)?$/.test(text)) values[key] = Number(text);
      else if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
          values[key] = JSON.parse(text);
        } catch {
          values[key] = text;
        }
      } else values[key] = text;
    }
    return values;
  };

  const handleSaveRow = () =>
    runAction(async () => {
      const values = parseDraftValues();
      if (rowMatch) {
        const res = await fetch(`/api/data/tables/${encodeURIComponent(selectedTable)}/rows`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match: rowMatch, values })
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || 'Không cập nhật được dòng.');
      } else {
        const res = await fetch(`/api/data/tables/${encodeURIComponent(selectedTable)}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values })
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || 'Không thêm được dòng.');
      }
      setRowFormOpen(false);
    }, rowMatch ? 'Đã cập nhật dòng.' : 'Đã thêm dòng.');

  const handleDeleteRow = (row: Record<string, unknown>) => {
    if (!window.confirm('Xóa dòng này?')) return;
    const match: Record<string, unknown> = {};
    const keys = pkColumns.length > 0 ? pkColumns : Object.keys(row).slice(0, 1);
    keys.forEach(key => {
      match[key] = row[key];
    });
    void runAction(async () => {
      const res = await fetch(`/api/data/tables/${encodeURIComponent(selectedTable)}/rows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Không xóa được dòng.');
    }, 'Đã xóa dòng.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-zinc-950">
              <Database className="h-5 w-5 text-[#ef1b2d]" />
              Data
            </h2>
            <p className="text-xs font-semibold text-zinc-500">
              Schema public · bảng / cột / dữ liệu · DDL có confirm
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadTables()}
          disabled={loadingTables || busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loadingTables ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Tải lại
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        Thao tác DDL / ghi dữ liệu ảnh hưởng DB production và không hoàn tác. Không có ô SQL tự do.
      </div>
      {schemaSource === 'rest' ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
          Đã kết nối schema qua PostgREST (xem bảng/cột + CRUD dòng). DDL (tạo/xóa bảng, thêm/sửa cột)
          cần đặt <code className="font-mono">SUPABASE_DB_PASSWORD</code> hoặc{' '}
          <code className="font-mono">SUPABASE_DB_URL</code> trong <code className="font-mono">.env</code> rồi
          restart server.
        </div>
      ) : null}
      {schemaSource === 'postgres' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          Đã kết nối Postgres — schema + DDL đầy đủ.
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Bảng ({filteredTables.length})
            </p>
            {canCreate && ddlEnabled ? (
              <button
                type="button"
                onClick={() => setCreateTableOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2 text-[11px] font-extrabold text-[#ef1b2d]"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo bảng
              </button>
            ) : null}
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm bảng..."
            className="mb-2 h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm font-semibold"
          />
          <div className="max-h-[70vh] space-y-1 overflow-auto">
            {filteredTables.map(table => (
              <button
                key={table.name}
                type="button"
                onClick={() => setSelectedTable(table.name)}
                className={`flex w-full flex-col rounded-lg border px-2.5 py-2 text-left transition ${
                  selectedTable === table.name
                    ? 'border-[#ef1b2d] bg-red-50'
                    : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <span className="truncate font-mono text-xs font-black text-zinc-900">{table.name}</span>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {table.columnCount} cột · ~{table.estimatedRows} dòng
                </span>
              </button>
            ))}
            {!loadingTables && filteredTables.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs font-bold text-zinc-400">Không có bảng.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          {!selectedTable ? (
            <p className="px-2 py-16 text-center text-sm font-bold text-zinc-400">Chọn một bảng bên trái.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-black text-zinc-950">{selectedTable}</p>
                  <p className="text-[11px] font-semibold text-zinc-500">public.{selectedTable}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailTab('columns')}
                    className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-extrabold ${
                      detailTab === 'columns'
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    Cột
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('rows')}
                    className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-extrabold ${
                      detailTab === 'rows'
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Dữ liệu
                  </button>
                  {canDelete && ddlEnabled ? (
                    <button
                      type="button"
                      onClick={handleDropTable}
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-extrabold text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa bảng
                    </button>
                  ) : null}
                </div>
              </div>

              {loadingDetail ? (
                <p className="flex items-center gap-2 py-10 text-xs font-bold text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                </p>
              ) : detailTab === 'columns' ? (
                <div className="space-y-2">
                  {canCreate && ddlEnabled ? (
                    <button
                      type="button"
                      onClick={() => setAddColOpen(true)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-extrabold text-emerald-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm cột
                    </button>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-2 py-2">Cột</th>
                          <th className="px-2 py-2">Kiểu</th>
                          <th className="px-2 py-2">Null</th>
                          <th className="px-2 py-2">PK</th>
                          <th className="px-2 py-2">Default</th>
                          <th className="px-2 py-2">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {columns.map(col => (
                          <tr key={col.name} className="hover:bg-zinc-50">
                            <td className="px-2 py-2 font-mono font-bold">{col.name}</td>
                            <td className="px-2 py-2">{col.dataType}</td>
                            <td className="px-2 py-2">{col.isNullable ? 'YES' : 'NO'}</td>
                            <td className="px-2 py-2">{col.isPrimaryKey ? 'PK' : ''}</td>
                            <td className="max-w-[180px] truncate px-2 py-2 text-zinc-500" title={col.columnDefault || ''}>
                              {col.columnDefault || '—'}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                {canEdit && ddlEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditCol(col);
                                      setEditColName(col.name);
                                      setEditColType(
                                        COLUMN_TYPES.includes(col.dataType as (typeof COLUMN_TYPES)[number])
                                          ? col.dataType
                                          : col.udtName || 'text'
                                      );
                                      setEditColNullable(col.isNullable);
                                    }}
                                    className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                ) : null}
                                {canDelete && ddlEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDropColumn(col.name)}
                                    className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {canCreate ? (
                      <button
                        type="button"
                        onClick={openNewRow}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-extrabold text-emerald-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm dòng
                      </button>
                    ) : (
                      <span />
                    )}
                    <p className="text-[11px] font-semibold text-zinc-500">
                      {rowCount} dòng · trang {Math.floor(offset / limit) + 1}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          {columns.map(col => (
                            <th key={col.name} className="whitespace-nowrap px-2 py-2">
                              {col.name}
                            </th>
                          ))}
                          <th className="px-2 py-2">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {rows.map((row, index) => (
                          <tr key={index} className="hover:bg-zinc-50">
                            {columns.map(col => (
                              <td key={col.name} className="max-w-[180px] truncate px-2 py-1.5 font-mono text-[11px]">
                                {row[col.name] == null
                                  ? 'null'
                                  : typeof row[col.name] === 'object'
                                    ? JSON.stringify(row[col.name])
                                    : String(row[col.name])}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-2 py-1.5">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => openEditRow(row)}
                                  className="mr-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                                >
                                  Sửa
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(row)}
                                  className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                                >
                                  Xóa
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={offset <= 0 || busy}
                      onClick={() => void loadRows(selectedTable, Math.max(0, offset - limit))}
                      className="h-8 rounded-lg border border-zinc-200 px-3 text-[11px] font-bold disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={offset + limit >= rowCount || busy}
                      onClick={() => void loadRows(selectedTable, offset + limit)}
                      className="h-8 rounded-lg border border-zinc-200 px-3 text-[11px] font-bold disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {createTableOpen ? (
        <Modal title="Tạo bảng mới" onClose={() => setCreateTableOpen(false)}>
          <label className="block space-y-1 text-xs font-bold text-zinc-600">
            Tên bảng
            <input
              value={newTableName}
              onChange={event => setNewTableName(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 px-2 font-mono text-sm"
              placeholder="vd: bang_thu_nghiem"
            />
          </label>
          <div className="mt-3 space-y-2">
            {newTableCols.map((col, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  value={col.name}
                  onChange={event =>
                    setNewTableCols(prev =>
                      prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item))
                    )
                  }
                  className="h-9 rounded-lg border border-zinc-200 px-2 font-mono text-xs"
                  placeholder="tên cột"
                />
                <select
                  value={col.type}
                  onChange={event =>
                    setNewTableCols(prev =>
                      prev.map((item, i) => (i === index ? { ...item, type: event.target.value } : item))
                    )
                  }
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-xs"
                >
                  {COLUMN_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    checked={col.nullable}
                    onChange={event =>
                      setNewTableCols(prev =>
                        prev.map((item, i) => (i === index ? { ...item, nullable: event.target.checked } : item))
                      )
                    }
                  />
                  Null
                </label>
                <label className="flex items-center gap-1 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    checked={col.primaryKey}
                    onChange={event =>
                      setNewTableCols(prev =>
                        prev.map((item, i) => (i === index ? { ...item, primaryKey: event.target.checked } : item))
                      )
                    }
                  />
                  PK
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setNewTableCols(prev => [...prev, { name: '', type: 'text', nullable: true, primaryKey: false }])
              }
              className="text-[11px] font-bold text-[#ef1b2d]"
            >
              + Thêm cột form
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateTableOpen(false)} className="h-9 rounded-lg border px-3 text-xs font-bold">
              Hủy
            </button>
            <button
              type="button"
              disabled={busy || !newTableName.trim()}
              onClick={() => void handleCreateTable()}
              className="h-9 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Tạo bảng
            </button>
          </div>
        </Modal>
      ) : null}

      {addColOpen ? (
        <Modal title={`Thêm cột · ${selectedTable}`} onClose={() => setAddColOpen(false)}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={addColName}
              onChange={event => setAddColName(event.target.value)}
              className="h-9 rounded-lg border px-2 font-mono text-sm"
              placeholder="tên cột"
            />
            <select
              value={addColType}
              onChange={event => setAddColType(event.target.value)}
              className="h-9 rounded-lg border px-2 text-sm"
            >
              {COLUMN_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={addColNullable} onChange={event => setAddColNullable(event.target.checked)} />
              Cho phép null
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAddColOpen(false)} className="h-9 rounded-lg border px-3 text-xs font-bold">
              Hủy
            </button>
            <button
              type="button"
              disabled={busy || !addColName.trim()}
              onClick={() => void handleAddColumn()}
              className="h-9 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Thêm cột
            </button>
          </div>
        </Modal>
      ) : null}

      {editCol ? (
        <Modal title={`Sửa cột · ${editCol.name}`} onClose={() => setEditCol(null)}>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={editColName}
              onChange={event => setEditColName(event.target.value)}
              className="h-9 rounded-lg border px-2 font-mono text-sm"
            />
            <select
              value={editColType}
              onChange={event => setEditColType(event.target.value)}
              className="h-9 rounded-lg border px-2 text-sm"
            >
              {COLUMN_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={editColNullable}
                onChange={event => setEditColNullable(event.target.checked)}
              />
              Cho phép null
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEditCol(null)} className="h-9 rounded-lg border px-3 text-xs font-bold">
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveColumn}
              className="h-9 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Lưu cột
            </button>
          </div>
        </Modal>
      ) : null}

      {rowFormOpen ? (
        <Modal title={rowMatch ? 'Sửa dòng' : 'Thêm dòng'} onClose={() => setRowFormOpen(false)}>
          <div className="max-h-[50vh] space-y-2 overflow-auto">
            {columns.map(col => (
              <label key={col.name} className="block space-y-1 text-[11px] font-bold text-zinc-600">
                {col.name}
                <input
                  value={rowDraft[col.name] || ''}
                  onChange={event => setRowDraft(prev => ({ ...prev, [col.name]: event.target.value }))}
                  className="h-9 w-full rounded-lg border px-2 font-mono text-xs"
                  disabled={Boolean(rowMatch && pkColumns.includes(col.name))}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setRowFormOpen(false)} className="h-9 rounded-lg border px-3 text-xs font-bold">
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveRow()}
              className="h-9 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white disabled:opacity-50"
            >
              Lưu dòng
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-zinc-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-xs font-bold text-zinc-500">
            Đóng
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default DataAdminPanel;
