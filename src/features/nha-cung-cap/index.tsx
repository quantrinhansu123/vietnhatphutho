import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Eye, FileUp, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';
import { pickText } from '../_shared/recordHelpers';
import { orderFieldClass } from '../_shared/orderHelpers';
import { showAppToast, showSaveFailure, readApiErrorMessage } from '../../lib/appToast';
import {
  downloadSupplierExcel,
  downloadSupplierExcelTemplate,
  downloadSupplierCsvTemplate,
  parseSupplierExcel
} from '../../utils/supplierExcel';
import {
  FilterCombobox,
  TableToolbar,
  TableSearchInput,
  TableShell,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableEmptyRow,
  TablePagination,
  usePagination,
  RowActionsMenu
} from '../../components/shared/table';

export interface SupplierOption {
  id: string;
  dbId: string;
  code: string;
  name: string;
  address: string;
  debt: number;
  taxCode: string;
  invoiceRisk: string;
  referenceDoc: string;
  phone: string;
  isInternal: boolean;
  isGroup: boolean;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === '') continue;
    const normalized =
      typeof value === 'number' ? value : Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(normalized)) return normalized;
  }
  return 0;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim().toLowerCase();
    return ['true', '1', 'co', 'có', 'x', 'yes'].includes(text);
  }
  return false;
}

function normalizePhoneList(value: string) {
  return value
    .split(/[,;\n]+/)
    .map(phone => phone.trim())
    .filter(Boolean)
    .join(', ');
}

export function normalizeSupplierOptions(data: unknown): SupplierOption[] {
  if (!data || typeof data !== 'object') return [];
  const suppliers = (data as { suppliers?: unknown }).suppliers;
  if (!Array.isArray(suppliers)) return [];

  return suppliers
    .map((item): SupplierOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['ten_nha_cung_cap', 'ten_ncc', 'ten', 'name'], '');
      const code = pickText(record, ['ma_nha_cung_cap', 'ma_ncc', 'ma', 'code', 'id'], '');
      if (!name && !code) return null;
      return {
        id: code || name,
        dbId: pickText(record, ['id'], ''),
        code,
        name: name || code,
        address: pickText(record, ['dia_chi', 'address'], ''),
        debt: pickNumber(record, ['so_tien_no', 'so_tien_con_no', 'cong_no', 'debt']),
        taxCode: pickText(record, ['ma_so_thue_cccd', 'ma_so_thue', 'cccd', 'tax_code'], ''),
        invoiceRisk: pickText(record, ['rui_ro_hoa_don', 'rui_ro', 'risk'], ''),
        referenceDoc: pickText(record, ['van_ban_tham_chieu', 'van_ban', 'tham_chieu', 'reference'], ''),
        phone: pickText(record, ['dien_thoai', 'so_dien_thoai', 'phone', 'sdt'], ''),
        isInternal: pickBoolean(record, ['la_doi_tuong_noi_bo', 'is_internal', 'la_doi_tuong']),
        isGroup: pickBoolean(record, ['la_tong_cong_ty_chi_nhanh', 'is_group', 'tong_cong_ty'])
      };
    })
    .filter((item): item is SupplierOption => Boolean(item));
}

function generateNextSupplierCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^NCC(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  return `NCC${String(next).padStart(Math.max(3, String(next).length), '0')}`;
}

type SupplierForm = {
  ma_nha_cung_cap: string;
  ten_nha_cung_cap: string;
  dia_chi: string;
  so_tien_no: string;
  ma_so_thue_cccd: string;
  rui_ro_hoa_don: string;
  van_ban_tham_chieu: string;
  dien_thoai: string;
  la_doi_tuong_noi_bo: boolean;
  la_tong_cong_ty_chi_nhanh: boolean;
};

function emptyForm(code = ''): SupplierForm {
  return {
    ma_nha_cung_cap: code,
    ten_nha_cung_cap: '',
    dia_chi: '',
    so_tien_no: '',
    ma_so_thue_cccd: '',
    rui_ro_hoa_don: '',
    van_ban_tham_chieu: '',
    dien_thoai: '',
    la_doi_tuong_noi_bo: false,
    la_tong_cong_ty_chi_nhanh: false
  };
}

function parseDebtInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = Number(trimmed.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

export function SuppliersPanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('suppliers');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedInternal, setSelectedInternal] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierPageSize, setSupplierPageSize] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierOption | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const loadSuppliers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/nha-cung-cap');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách nhà cung cấp.');
      setSuppliers(normalizeSupplierOptions(data));
    } catch (loadError: any) {
      setSuppliers([]);
      setError(loadError.message || 'Không thể tải danh sách nhà cung cấp.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const hasActiveFilters =
    Boolean(searchText) || selectedInternal !== 'all' || selectedGroup !== 'all';

  const resetFilters = () => {
    setSearchText('');
    setSelectedInternal('all');
    setSelectedGroup('all');
    setSupplierPage(1);
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const matchesSearch =
        !normalizedSearch ||
        `${supplier.code} ${supplier.name} ${supplier.address} ${supplier.taxCode} ${supplier.invoiceRisk} ${supplier.referenceDoc} ${supplier.phone}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesInternal =
        selectedInternal === 'all' ||
        (selectedInternal === 'internal' ? supplier.isInternal : !supplier.isInternal);
      const matchesGroup =
        selectedGroup === 'all' ||
        (selectedGroup === 'group' ? supplier.isGroup : !supplier.isGroup);
      return matchesSearch && matchesInternal && matchesGroup;
    });
  }, [suppliers, normalizedSearch, selectedInternal, selectedGroup]);

  const { paginatedItems: paginatedSuppliers, totalPages: supplierTotalPages } = usePagination(
    filteredSuppliers,
    supplierPage,
    supplierPageSize
  );

  useEffect(() => {
    setSupplierPage(1);
  }, [normalizedSearch, selectedInternal, selectedGroup]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditingId(null);
    setForm(emptyForm(generateNextSupplierCode(suppliers.map(item => item.code))));
    setFormOpen(true);
    setError('');
  };

  const openEdit = (supplier: SupplierOption) => {
    if (!canEdit) return;
    setEditingId(supplier.code || supplier.dbId || supplier.id);
    setForm({
      ma_nha_cung_cap: supplier.code,
      ten_nha_cung_cap: supplier.name,
      dia_chi: supplier.address,
      so_tien_no: supplier.debt ? String(supplier.debt) : '',
      ma_so_thue_cccd: supplier.taxCode,
      rui_ro_hoa_don: supplier.invoiceRisk,
      van_ban_tham_chieu: supplier.referenceDoc,
      dien_thoai: supplier.phone,
      la_doi_tuong_noi_bo: supplier.isInternal,
      la_tong_cong_ty_chi_nhanh: supplier.isGroup
    });
    setFormOpen(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.ten_nha_cung_cap.trim()) {
      setError(showSaveFailure('Vui lòng nhập tên nhà cung cấp.'));
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(
        editingId ? `/api/nha-cung-cap/${encodeURIComponent(editingId)}` : '/api/nha-cung-cap',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ma_nha_cung_cap: form.ma_nha_cung_cap.trim(),
            ten_nha_cung_cap: form.ten_nha_cung_cap.trim(),
            dia_chi: form.dia_chi.trim(),
            so_tien_no: parseDebtInput(form.so_tien_no),
            ma_so_thue_cccd: form.ma_so_thue_cccd.trim(),
            rui_ro_hoa_don: form.rui_ro_hoa_don.trim(),
            van_ban_tham_chieu: form.van_ban_tham_chieu.trim(),
            dien_thoai: normalizePhoneList(form.dien_thoai),
            la_doi_tuong_noi_bo: form.la_doi_tuong_noi_bo,
            la_tong_cong_ty_chi_nhanh: form.la_tong_cong_ty_chi_nhanh
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          readApiErrorMessage(res, data, editingId ? 'Không thể cập nhật nhà cung cấp.' : 'Không thể thêm nhà cung cấp.')
        );
      }
      showAppToast(editingId ? 'Đã cập nhật nhà cung cấp.' : 'Đã thêm nhà cung cấp.');
      setFormOpen(false);
      setEditingId(null);
      await loadSuppliers();
    } catch (saveError: unknown) {
      setError(showSaveFailure(saveError, editingId ? 'Không thể cập nhật nhà cung cấp.' : 'Không thể thêm nhà cung cấp.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: SupplierOption) => {
    const targetId = supplier.code || supplier.dbId || supplier.id;
    if (!window.confirm(`Xóa nhà cung cấp ${supplier.code ? `${supplier.code} - ` : ''}${supplier.name}?`)) return;

    setDeletingId(targetId);
    setError('');
    try {
      const res = await fetch(`/api/nha-cung-cap/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(readApiErrorMessage(res, data, 'Không thể xóa nhà cung cấp.'));
      }
      showAppToast('Đã xóa nhà cung cấp.');
      await loadSuppliers();
    } catch (deleteError: unknown) {
      setError(showSaveFailure(deleteError, 'Không thể xóa nhà cung cấp.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExcelImport = async (file?: File | null) => {
    if ((!canCreate && !canEdit) || !file) return;

    setIsImporting(true);
    setError('');
    try {
      const rows = await parseSupplierExcel(file);
      if (rows.length === 0) throw new Error('File Excel/CSV không có dòng dữ liệu nhà cung cấp.');

      const byCode = new Map(
        suppliers
          .map(item => [item.code.trim().toUpperCase(), item] as const)
          .filter(([code]) => Boolean(code))
      );
      const generatedCodes = suppliers.map(item => item.code).filter(Boolean);

      const createMap = new Map<string, Record<string, unknown>>();
      const updateMap = new Map<string, Record<string, unknown>>();
      const failures: string[] = [];

      for (const row of rows) {
        const name = row.name.trim();
        if (!name) {
          failures.push(`dòng ${row.rowNumber}: thiếu tên nhà cung cấp`);
          continue;
        }

        let code = row.code.trim();
        if (!code) {
          code = generateNextSupplierCode(generatedCodes);
          generatedCodes.push(code);
        }

        const codeKey = code.toUpperCase();
        const payload = {
          ma_nha_cung_cap: code,
          ten_nha_cung_cap: name,
          dia_chi: row.address.trim(),
          so_tien_no: row.debt.trim() ? Number(String(row.debt).trim().replace(/\./g, '').replace(',', '.')) || 0 : 0,
          ma_so_thue_cccd: row.taxCode.trim(),
          rui_ro_hoa_don: row.invoiceRisk.trim(),
          van_ban_tham_chieu: row.referenceDoc.trim(),
          dien_thoai: normalizePhoneList(row.phone),
          la_doi_tuong_noi_bo: ['true', '1', 'co', 'có', 'x', 'yes'].includes(
            row.isInternal.trim().toLowerCase()
          ),
          la_tong_cong_ty_chi_nhanh: ['true', '1', 'co', 'có', 'x', 'yes'].includes(
            row.isGroup.trim().toLowerCase()
          )
        };

        if (byCode.has(codeKey)) {
          updateMap.set(codeKey, payload);
        } else {
          createMap.set(codeKey, payload);
          if (!generatedCodes.some(item => item.toUpperCase() === codeKey)) {
            generatedCodes.push(code);
          }
        }
      }

      const creates = [...createMap.values()];
      const updates = [...updateMap.values()];

      const IMPORT_BATCH_SIZE = 200;
      const chunkArray = <T,>(items: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let index = 0; index < items.length; index += size) {
          chunks.push(items.slice(index, index + size));
        }
        return chunks;
      };

      let created = 0;
      let updated = 0;

      const postBatch = async (
        createsChunk: Record<string, unknown>[],
        updatesChunk: Record<string, unknown>[],
        label: string
      ) => {
        if (createsChunk.length === 0 && updatesChunk.length === 0) return;
        const res = await fetch('/api/nha-cung-cap/import-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creates: createsChunk, updates: updatesChunk })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failures.push(`${label}: ${readApiErrorMessage(res, data, 'Không lưu được')}`);
          return;
        }
        created += Number(data.createdCount || 0);
        updated += Number(data.updatedCount || 0);
      };

      for (const [index, chunk] of chunkArray(creates, IMPORT_BATCH_SIZE).entries()) {
        await postBatch(chunk, [], `Insert batch ${index + 1}`);
      }
      for (const [index, chunk] of chunkArray(updates, IMPORT_BATCH_SIZE).entries()) {
        await postBatch([], chunk, `Update batch ${index + 1}`);
      }

      if (created > 0 || updated > 0) {
        await loadSuppliers();
      }

      const summary = [
        created || updated ? `Đã nhập Excel/CSV: thêm ${created}, cập nhật ${updated}.` : 'Không nhập được dòng nào.',
        failures.length ? `${failures.length} dòng lỗi (${failures.slice(0, 3).join('; ')}).` : ''
      ]
        .filter(Boolean)
        .join(' ');

      if (created > 0 || updated > 0) showAppToast(summary);
      else setError(summary);
    } catch (importError: unknown) {
      setError(showSaveFailure(importError, 'Không thể đọc hoặc nhập file Excel/CSV.'));
    } finally {
      setIsImporting(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-4">
      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:justify-end lg:gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadSupplierExcelTemplate()}
            disabled={isImporting || isLoading}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
            title="Tải file mẫu Excel nhập nhà cung cấp"
          >
            <Download className="h-4 w-4" />
            Tải mẫu Excel
          </button>
          <button
            type="button"
            onClick={() => downloadSupplierCsvTemplate()}
            disabled={isImporting || isLoading}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
            title="Tải file mẫu CSV nhập nhà cung cấp (cùng header với Excel)"
          >
            <Download className="h-4 w-4" />
            Tải mẫu CSV
          </button>
          <button
            type="button"
            onClick={() => downloadSupplierExcel(suppliers)}
            disabled={isImporting || isLoading || suppliers.length === 0}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
            title="Xuất danh sách nhà cung cấp hiện tại ra Excel"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
          {canCreate || canEdit ? (
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              disabled={isImporting || isLoading}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {isImporting ? 'Đang nhập...' : 'Tải Excel/CSV lên'}
            </button>
          ) : null}
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={event => void handleExcelImport(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={loadSuppliers}
            disabled={isLoading}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Đang tải...' : 'Tải lại'}
          </button>
          {canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c]"
            >
              <Plus className="h-4 w-4" />
              Thêm nhà cung cấp
            </button>
          ) : null}
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </section>
      )}

      <TableToolbar
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      >
        <TableSearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="Tìm mã, tên, địa chỉ, MST/CCCD, rủi ro, văn bản, điện thoại..."
          disabled={isLoading}
        />

        <FilterCombobox
          label="Đối tượng"
          options={['internal', 'external']}
          value={selectedInternal}
          onChange={setSelectedInternal}
          searchPlaceholder="Tìm loại đối tượng..."
          compact
          searchable={false}
          formatOption={value => (value === 'internal' ? 'Nội bộ' : 'Bên ngoài')}
        />

        <FilterCombobox
          label="Tổng CT / chi nhánh"
          options={['group', 'single']}
          value={selectedGroup}
          onChange={setSelectedGroup}
          searchPlaceholder="Tìm loại đơn vị..."
          compact
          searchable={false}
          formatOption={value => (value === 'group' ? 'Tổng CT / chi nhánh' : 'Đơn lẻ')}
        />
      </TableToolbar>

      <TableShell minWidthClassName="min-w-[1480px]">
        <TableHead>
          <TableHeadCell>STT</TableHeadCell>
          <TableHeadCell>Mã nhà cung cấp</TableHeadCell>
          <TableHeadCell>Tên nhà cung cấp</TableHeadCell>
          <TableHeadCell>Địa chỉ</TableHeadCell>
          <TableHeadCell>Số tiền nợ</TableHeadCell>
          <TableHeadCell>Mã số thuế/CCCD chủ hộ</TableHeadCell>
          <TableHeadCell>Rủi ro về hóa đơn</TableHeadCell>
          <TableHeadCell>Văn bản tham chiếu</TableHeadCell>
          <TableHeadCell>Điện thoại</TableHeadCell>
          <TableHeadCell>Là Đối tượng nội bộ</TableHeadCell>
          <TableHeadCell>Là Tổng công ty/chi nhánh</TableHeadCell>
          <TableHeadCell align="center">Thao tác</TableHeadCell>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center font-bold text-zinc-400">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Đang tải nhà cung cấp...
              </td>
            </tr>
          ) : filteredSuppliers.length === 0 ? (
            <TableEmptyRow colSpan={12}>Chưa có nhà cung cấp phù hợp.</TableEmptyRow>
          ) : (
            paginatedSuppliers.map((supplier, index) => (
              <React.Fragment key={supplier.id}>
                <TableRow>
                  <td className="px-4 py-3 font-black text-[#ef1b2d]">{index + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-900">{supplier.code || '-'}</td>
                  <td className="px-4 py-3 font-normal text-zinc-950">{supplier.name}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{supplier.address || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">
                    {supplier.debt ? supplier.debt.toLocaleString('vi-VN') : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-700">{supplier.taxCode || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{supplier.invoiceRisk || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{supplier.referenceDoc || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{supplier.phone || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">
                    {supplier.isInternal ? 'Có' : 'Không'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">
                    {supplier.isGroup ? 'Có' : 'Không'}
                  </td>
                  <td className="px-4 py-3">
                    <RowActionsMenu label={`Thao tác ${supplier.name}`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingSupplier(supplier)}
                          title="Xem"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-100"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEdit(supplier)}
                            title="Sửa"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-700 transition hover:bg-sky-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(supplier)}
                            disabled={deletingId === (supplier.code || supplier.dbId || supplier.id)}
                            title="Xóa"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {deletingId === (supplier.code || supplier.dbId || supplier.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </RowActionsMenu>
                  </td>
                </TableRow>
              </React.Fragment>
            ))
          )}
        </TableBody>
      </TableShell>

      {filteredSuppliers.length > 0 && (
        <div className="mt-4 flex justify-center rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
          <TablePagination
            totalRecords={filteredSuppliers.length}
            currentPage={supplierPage}
            totalPages={supplierTotalPages}
            pageSize={supplierPageSize}
            onPageChange={setSupplierPage}
            onPageSizeChange={(size) => {
              setSupplierPageSize(size);
              setSupplierPage(1);
            }}
            noBorderTop={true}
          />
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  {editingId ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {editingId ? 'Cập nhật thông tin nhà cung cấp' : 'Nhập thông tin nhà cung cấp mới'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mã nhà cung cấp</span>
                <input
                  value={form.ma_nha_cung_cap}
                  onChange={event => setForm(prev => ({ ...prev, ma_nha_cung_cap: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="NCC001"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tên nhà cung cấp *
                </span>
                <input
                  value={form.ten_nha_cung_cap}
                  onChange={event => setForm(prev => ({ ...prev, ten_nha_cung_cap: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Tên công ty / nhà cung cấp"
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Địa chỉ</span>
                <input
                  value={form.dia_chi}
                  onChange={event => setForm(prev => ({ ...prev, dia_chi: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Địa chỉ nhà cung cấp"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Số tiền nợ</span>
                <input
                  type="number"
                  value={form.so_tien_no}
                  onChange={event => setForm(prev => ({ ...prev, so_tien_no: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="0"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Mã số thuế/CCCD chủ hộ
                </span>
                <input
                  value={form.ma_so_thue_cccd}
                  onChange={event => setForm(prev => ({ ...prev, ma_so_thue_cccd: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Mã số thuế hoặc CCCD chủ hộ"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Rủi ro về hóa đơn
                </span>
                <input
                  value={form.rui_ro_hoa_don}
                  onChange={event => setForm(prev => ({ ...prev, rui_ro_hoa_don: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: Rủi ro cao / Thấp / Không xuất được HĐ..."
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Văn bản tham chiếu
                </span>
                <input
                  value={form.van_ban_tham_chieu}
                  onChange={event => setForm(prev => ({ ...prev, van_ban_tham_chieu: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Số văn bản / hợp đồng tham chiếu"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Điện thoại
                </span>
                <input
                  value={form.dien_thoai}
                  onChange={event => setForm(prev => ({ ...prev, dien_thoai: event.target.value }))}
                  onBlur={() =>
                    setForm(prev => ({ ...prev, dien_thoai: normalizePhoneList(prev.dien_thoai) }))
                  }
                  className={orderFieldClass}
                  placeholder="0123456789, 0213456789"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                <label className="flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <input
                    type="checkbox"
                    checked={form.la_doi_tuong_noi_bo}
                    onChange={event => setForm(prev => ({ ...prev, la_doi_tuong_noi_bo: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-[#ef1b2d] focus:ring-[#ef1b2d]"
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Là Đối tượng nội bộ
                  </span>
                </label>
                <label className="flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <input
                    type="checkbox"
                    checked={form.la_tong_cong_ty_chi_nhanh}
                    onChange={event => setForm(prev => ({ ...prev, la_tong_cong_ty_chi_nhanh: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-[#ef1b2d] focus:ring-[#ef1b2d]"
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Là Tổng công ty/chi nhánh
                  </span>
                </label>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                }}
                disabled={isSaving}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingSupplier ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Thông tin nhà cung cấp</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{viewingSupplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSupplier(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {[
                ['Mã nhà cung cấp', viewingSupplier.code || '-'],
                ['Tên nhà cung cấp', viewingSupplier.name || '-'],
                ['Địa chỉ', viewingSupplier.address || '-'],
                ['Số tiền nợ', viewingSupplier.debt ? viewingSupplier.debt.toLocaleString('vi-VN') : '-'],
                ['Mã số thuế/CCCD chủ hộ', viewingSupplier.taxCode || '-'],
                ['Rủi ro về hóa đơn', viewingSupplier.invoiceRisk || '-'],
                ['Văn bản tham chiếu', viewingSupplier.referenceDoc || '-'],
                ['Điện thoại', viewingSupplier.phone || '-'],
                ['Là Đối tượng nội bộ', viewingSupplier.isInternal ? 'Có' : 'Không'],
                ['Là Tổng công ty/chi nhánh', viewingSupplier.isGroup ? 'Có' : 'Không']
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
                  <span className="text-right text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    const supplier = viewingSupplier;
                    setViewingSupplier(null);
                    if (supplier) openEdit(supplier);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Sửa
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
