import React, { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { VnCalendarPicker } from '../so-che-do-may';
import type { ShiftOption } from '../../utils/shiftSettings';
import { formatMoney, formatQty } from '../../utils';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { reconcilePhysicalStock } from './stockModel';

type Option = { id: string; label: string };
type SoTronHandoverLine = {
  material_id?: unknown;
  ma_nvl?: unknown;
  ma_npl?: unknown;
  ten_nvl?: unknown;
  ten_nvl_sx?: unknown;
  don_vi?: unknown;
  dvt?: unknown;
  ton_cuoi_ca?: unknown;
};
type SoTronReport = {
  id: string;
  ngay: string;
  ca: string;
  ma_may: string;
  ten_may: string;
  bang_ban_giao: SoTronHandoverLine[];
};
type ExportLine = Record<string, unknown>;
type ExportHeader = {
  id: string;
  ma_phieu_chung: string;
  loai: string;
  ngay: string;
  loai_xuat: string;
  trang_thai: string;
  nguon_loai: string;
  nguon_id: string;
  dich_loai: string;
  dich_id: string;
  chi_tiet: ExportLine[];
};
type SourcePriceGroup = {
  key: string;
  warehouse: string;
  unitPrice: number;
  issuedQty: number;
  returnedQty: number;
  slipCodes: string[];
};
type MachineStockRow = {
  reportId?: string;
  machine?: string;
  code: string;
  name: string;
  productionName: string;
  unit: string;
  quantity: number;
  sourceGroups: SourcePriceGroup[];
};
const RETURN_KIND = 'Nhập lại từ máy vào kho';
const ALL_MACHINES = '__ALL_MACHINES__';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function numberOf(value: unknown) {
  const raw = String(value ?? '').trim().replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fold(value: unknown) {
  return text(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function priceKey(value: number) {
  return (Math.round(value * 10000) / 10000).toFixed(4);
}

function formatDateVN(value: string) {
  const [year, month, day] = text(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : text(value);
}

export function MachineStockTab({
  machines,
  shifts
}: {
  machines: Option[];
  shifts: ShiftOption[];
}) {
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('');
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [reports, setReports] = useState<SoTronReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [stockRows, setStockRows] = useState<MachineStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadedExports, setLoadedExports] = useState<ExportHeader[]>([]);
  const [loadedReturns, setLoadedReturns] = useState<ExportHeader[]>([]);
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]);
  const exportHeaders = loadedExports;
  const returnHeaders = loadedReturns;

  const allMachinesMode = machineIds.includes(ALL_MACHINES);
  const selectedMachineIds = allMachinesMode ? machines.map(item => item.id) : machineIds;
  const selectedMachine = selectedMachineIds.length === 1 ? machines.find(item => item.id === selectedMachineIds[0]) : undefined;
  const multiMachineMode = selectedMachineIds.length !== 1;
  const selectedReport = reports.find(report => report.id === selectedReportId) || reports[0] || null;
  const sourceHistory = useMemo(() => {
    const result = new Map<string, Map<string, SourcePriceGroup>>();
    if (!selectedReport || !selectedMachine) return result;

    const ensureGroup = (code: string, warehouse: string, unitPrice: number) => {
      const lineMap = result.get(code) || new Map<string, SourcePriceGroup>();
      const key = `${warehouse}||${priceKey(unitPrice)}`;
      const group = lineMap.get(key) || {
        key,
        warehouse,
        unitPrice,
        issuedQty: 0,
        returnedQty: 0,
        slipCodes: []
      };
      lineMap.set(key, group);
      result.set(code, lineMap);
      return group;
    };

    // Group original machine supply by material + source warehouse + filled unit price.
    for (const header of exportHeaders) {
      if (header.loai !== 'xuat' || header.loai_xuat === RETURN_KIND || header.trang_thai === 'huy') continue;
      if (text(header.ngay).slice(0, 10) > selectedReport.ngay) continue;
      for (const line of Array.isArray(header.chi_tiet) ? header.chi_tiet : []) {
        const destinationKind = fold(line.dich_dong_loai ?? header.dich_loai);
        const destinationId = text(line.dich_dong_id ?? header.dich_id);
        const legacyMachine = text(line.may);
        const goesToMachine =
          (destinationKind === 'may' && fold(destinationId) === fold(selectedMachine.id)) ||
          fold(legacyMachine) === fold(selectedMachine.id);
        if (!goesToMachine) continue;
        const code = text(line.ma_hang);
        if (!code) continue;
        const sourceKind = fold(line.src_loai ?? line.nguon_dong_loai ?? header.nguon_loai);
        if (sourceKind && sourceKind !== 'kho') continue;
        const warehouse = text(line.src_id ?? line.nguon_dong_id ?? header.nguon_id ?? line.src_ten);
        if (!warehouse) continue;
        const group = ensureGroup(code, warehouse, numberOf(line.don_gia));
        group.issuedQty += numberOf(line.so_luong);
        const slipCode = text(header.ma_phieu_chung);
        if (slipCode && !group.slipCodes.includes(slipCode)) group.slipCodes.push(slipCode);
      }
    }

    // Returns made from this exact Sổ trộn report reduce the same material/warehouse/price bucket.
    for (const header of returnHeaders) {
      if (header.trang_thai === 'huy') continue;
      for (const line of Array.isArray(header.chi_tiet) ? header.chi_tiet : []) {
        if (text(line.so_tron_id) !== selectedReport.id) continue;
        const code = text(line.ma_hang);
        if (!code) continue;
        const sourceWarehouse = text(line.ton_may_nhom_kho) || text(line.kho_dong_id);
        const group = ensureGroup(code, sourceWarehouse, numberOf(line.don_gia));
        group.returnedQty += numberOf(line.so_luong);
      }
    }

    return result;
  }, [exportHeaders, returnHeaders, selectedMachine, selectedReport]);

  React.useEffect(() => {
    let alive = true;
    void fetch('/api/kho-nvl')
      .then(response => response.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const rows = Array.isArray(data.materials) ? data.materials : Array.isArray(data.records) ? data.records : [];
        setCatalog(rows as Array<Record<string, unknown>>);
      })
      .catch(() => {
        if (alive) setCatalog([]);
      });
    return () => { alive = false; };
  }, []);

  async function loadStock() {
    if (!date || !shift || selectedMachineIds.length === 0) {
      setError('Chọn ngày, ca và ít nhất một máy để kiểm tra tồn cuối ca.');
      return;
    }
    setLoading(true);
    setLoaded(false);
    setError('');
    setNotice('');
    setStockRows([]);
    setReports([]);
    try {
      const reportParams = new URLSearchParams({ ngay: date, ca: shift, limit: '1000' });
      const reportResponse = await fetch(`/api/so-tron?${reportParams.toString()}`);
      const reportData = await reportResponse.json().catch(() => ({}));
      if (!reportResponse.ok) throw new Error(reportData.error || 'Không tải được Sổ trộn.');
      let matched = (Array.isArray(reportData.reports) ? reportData.reports : []) as SoTronReport[];
      matched = matched.filter(report =>
        text(report.ngay).slice(0, 10) === date &&
        fold(report.ca) === fold(shift) &&
        selectedMachineIds.some(id => {
          const option = machines.find(item => item.id === id);
          const machineName = option?.label.split('—').slice(1).join('—').trim() || '';
          return [report.ma_may, report.ten_may].some(value => fold(value) === fold(id) || (machineName && fold(value) === fold(machineName)));
        })
      );
      if (matched.length === 0) {
        setLoaded(true);
        setNotice('Không có phiếu Sổ trộn khớp ngày, ca và máy đã chọn.');
        return;
      }

      const exportParams = new URLSearchParams({ loai: 'xuat', to: date, limit: '2000' });
      const returnParams = new URLSearchParams({ loai: 'xuat', loai_xuat: RETURN_KIND, limit: '2000' });
      const [exportResponse, returnResponse] = await Promise.all([
        fetch(`/api/xuat-nhap-tong-hop?${exportParams.toString()}`),
        fetch(`/api/xuat-nhap-tong-hop?${returnParams.toString()}`)
      ]);
      const [exportData, returnData] = await Promise.all([
        exportResponse.json().catch(() => ({})),
        returnResponse.json().catch(() => ({}))
      ]);
      if (!exportResponse.ok) throw new Error(exportData.error || 'Không tải được lịch sử xuất NVL cho máy.');
      if (!returnResponse.ok) throw new Error(returnData.error || 'Không tải được lịch sử nhập lại máy.');
      setLoadedExports((Array.isArray(exportData.records) ? exportData.records : []) as ExportHeader[]);
      setLoadedReturns((Array.isArray(returnData.records) ? returnData.records : []) as ExportHeader[]);
      setReports(matched);
      setSelectedReportId(matched[0].id);

      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tồn cuối máy.');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  // Rebuild lines when the operator selects a different matching Sổ trộn report.
  React.useEffect(() => {
    if (!selectedReport || reports.length === 0) return;
    const rawLines = Array.isArray(selectedReport.bang_ban_giao) ? selectedReport.bang_ban_giao : [];
    setStockRows(rawLines.map(line => {
      const code = text(line.ma_nvl || line.ma_npl);
      const material = catalog.find(item => text(item.ma_npl) === code || text(item.id) === text(line.material_id));
      return {
        code,
        name: text(line.ten_nvl) || text(material?.ten_npl),
        productionName: text(line.ten_nvl_sx) || text(material?.ten_nvl_sx),
        unit: text(line.don_vi || line.dvt) || text(material?.don_vi),
        quantity: numberOf(line.ton_cuoi_ca),
        sourceGroups: [...(sourceHistory.get(code)?.values() || [])]
      };
    }).filter(line => Boolean(line.code)));
  }, [selectedReportId, reports, selectedReport, catalog, sourceHistory]);

  const allMachineRows = useMemo(() => reports.flatMap(report => {
    const selectedMachineOption = machines.find(item =>
      fold(item.id) === fold(report.ma_may) ||
      fold(item.label.split('—').slice(1).join('—').trim()) === fold(report.ten_may)
    );
    const machine = selectedMachineOption?.label || report.ten_may || report.ma_may;
    const sourceGroupsByCode = new Map<string, Map<string, SourcePriceGroup>>();
    const ensureGroup = (code: string, warehouse: string, unitPrice: number) => {
      const byKey = sourceGroupsByCode.get(code) || new Map<string, SourcePriceGroup>();
      const key = `${warehouse}||${priceKey(unitPrice)}`;
      const group = byKey.get(key) || {
        key,
        warehouse,
        unitPrice,
        issuedQty: 0,
        returnedQty: 0,
        slipCodes: []
      };
      byKey.set(key, group);
      sourceGroupsByCode.set(code, byKey);
      return group;
    };
    for (const header of exportHeaders) {
      if (header.loai !== 'xuat' || header.loai_xuat === RETURN_KIND || header.trang_thai === 'huy') continue;
      if (text(header.ngay).slice(0, 10) > report.ngay) continue;
      for (const line of Array.isArray(header.chi_tiet) ? header.chi_tiet : []) {
        const destinationKind = fold(line.dich_dong_loai ?? header.dich_loai);
        const destinationId = text(line.dich_dong_id ?? header.dich_id);
        if (destinationKind !== 'may' || fold(destinationId) !== fold(report.ma_may)) continue;
        const code = text(line.ma_hang);
        const sourceKind = fold(line.src_loai ?? line.nguon_dong_loai ?? header.nguon_loai);
        const warehouse = text(line.src_id ?? line.nguon_dong_id ?? header.nguon_id ?? line.src_ten);
        if (!code || (sourceKind && sourceKind !== 'kho') || !warehouse) continue;
        const group = ensureGroup(code, warehouse, numberOf(line.don_gia));
        group.issuedQty += numberOf(line.so_luong);
        const slipCode = text(header.ma_phieu_chung);
        if (slipCode && !group.slipCodes.includes(slipCode)) group.slipCodes.push(slipCode);
      }
    }
    for (const header of returnHeaders) {
      if (header.trang_thai === 'huy') continue;
      for (const line of Array.isArray(header.chi_tiet) ? header.chi_tiet : []) {
        if (text(line.so_tron_id) !== report.id) continue;
        const code = text(line.ma_hang);
        if (!code) continue;
        const sourceWarehouse = text(line.ton_may_nhom_kho) || text(line.kho_dong_id);
        ensureGroup(code, sourceWarehouse, numberOf(line.don_gia)).returnedQty += numberOf(line.so_luong);
      }
    }
    return (Array.isArray(report.bang_ban_giao) ? report.bang_ban_giao : []).map(line => {
      const code = text(line.ma_nvl || line.ma_npl);
      const material = catalog.find(item => text(item.ma_npl) === code || text(item.id) === text(line.material_id));
      return {
        reportId: report.id,
        machine,
        code,
        name: text(line.ten_nvl) || text(material?.ten_npl),
        productionName: text(line.ten_nvl_sx) || text(material?.ten_nvl_sx),
        unit: text(line.don_vi || line.dvt) || text(material?.don_vi),
        quantity: numberOf(line.ton_cuoi_ca),
        sourceGroups: [...(sourceGroupsByCode.get(code)?.values() || [])]
      };
    }).filter(line => Boolean(line.code));
  }), [reports, machines, catalog, exportHeaders, returnHeaders]);
  const displayedRows = multiMachineMode ? allMachineRows : stockRows;
  const displayedTotalQuantity = displayedRows.reduce((sum, row) => sum + row.quantity, 0);
  const rowReconKey = (row: MachineStockRow, index: number) =>
    `${row.reportId || ''}|${row.machine || ''}|${row.code}|${index}`;
  const reconcileByRow = useMemo(() => {
    const map = new Map<string, ReturnType<typeof reconcilePhysicalStock>[number]>();
    displayedRows.forEach((row, index) => {
      const [recon] = reconcilePhysicalStock([{
        code: row.code,
        name: row.productionName || row.name,
        physical: row.quantity,
        issued: row.sourceGroups.reduce((sum, group) => sum + group.issuedQty, 0),
        returned: row.sourceGroups.reduce((sum, group) => sum + group.returnedQty, 0)
      }]);
      if (recon) map.set(rowReconKey(row, index), recon);
    });
    return map;
  }, [displayedRows]);
  const mismatchCount = [...reconcileByRow.values()].filter(
    row => Math.abs(row.delta) > 1e-6 && row.issued + row.returned > 0
  ).length;
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Ngày</span>
            <VnCalendarPicker value={date} onChange={setDate} triggerClassName="min-h-10" />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Ca</span>
            <select value={shift} onChange={event => setShift(event.target.value)} className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700">
              <option value="">Chọn ca</option>
              {shifts.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Máy</span>
            <SearchableMultiSelect<Option>
              values={allMachinesMode ? [{ id: ALL_MACHINES, label: 'Tất cả máy' }] : machines.filter(item => machineIds.includes(item.id))}
              options={[{ id: ALL_MACHINES, label: 'Tất cả máy' }, ...machines]}
              onChange={values => {
                if (values.some(item => item.id === ALL_MACHINES)) {
                  const selectedActualMachines = values.filter(item => item.id !== ALL_MACHINES).map(item => item.id);
                  setMachineIds(allMachinesMode && selectedActualMachines.length ? selectedActualMachines : [ALL_MACHINES]);
                }
                else setMachineIds(values.map(item => item.id).filter(id => id !== ALL_MACHINES));
              }}
              getValue={item => item.id}
              getLabel={item => item.label}
              placeholder="Chọn máy"
              allowCustomValues={false}
              inputClassName="min-h-10 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
            />
          </label>
          <button type="button" onClick={() => void loadStock()} disabled={loading} className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white disabled:opacity-60">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Kiểm tra tồn
          </button>
        </div>
      </section>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
      {notice ? <p className="px-3 py-2 text-sm text-zinc-600">{notice}</p> : null}

      {loaded && reports.length > 1 && !multiMachineMode ? (
        <label className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
          Phiếu Sổ trộn
          <select value={selectedReportId} onChange={event => setSelectedReportId(event.target.value)} className="min-w-0 max-w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs">
            {reports.map((report, index) => <option key={report.id} value={report.id}>{`Phiếu ${index + 1} · ${report.id}`}</option>)}
          </select>
        </label>
      ) : null}

      {loaded && (multiMachineMode ? reports.length > 0 : Boolean(selectedReport)) ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
            <span className="text-zinc-600">{formatDateVN(date)} · {shift}</span>
            <span className="text-zinc-600">{allMachinesMode ? `Tất cả máy · ${reports.length} phiếu Sổ trộn` : multiMachineMode ? `${selectedMachineIds.length} máy · ${reports.length} phiếu Sổ trộn` : selectedMachine?.label || selectedReport?.ten_may || selectedReport?.ma_may}</span>
            <span className="font-semibold tabular-nums text-zinc-900">Tổng tồn cuối ca: {formatQty(displayedTotalQuantity)}</span>
            {mismatchCount > 0 ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                {mismatchCount} mã lệch tồn sổ ↔ chứng từ cấp
              </span>
            ) : displayedRows.some(row => row.sourceGroups.length > 0) ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                Tồn sổ khớp phần còn theo chứng từ cấp
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-zinc-500">
            Đối chiếu: Tồn sổ trộn so với (Đã cấp − Đã nhập lại). Chênh lệch âm ≈ đã sử dụng; lệch bất thường khi thiếu chứng từ cấp/nhập lại.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-[880px] w-full text-xs">
              <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-700">
                {multiMachineMode ? <th className="px-3 py-2">Máy</th> : null}<th className="px-3 py-2">Mã NVL</th><th className="px-3 py-2">Tên NVL</th><th className="px-3 py-2">ĐVT</th>
                <th className="px-3 py-2 text-right">Tồn sổ</th>
                <th className="px-3 py-2 text-right">Còn theo cấp</th>
                <th className="px-3 py-2 text-right">Chênh</th>
                <th className="px-3 py-2">Kho đã cấp · giá</th>
              </tr></thead>
              <tbody>
                {displayedRows.map((row, index) => {
                  const recon = reconcileByRow.get(rowReconKey(row, index));
                  const hasDocs = (recon?.issued || 0) + (recon?.returned || 0) > 0;
                  const delta = recon?.delta ?? 0;
                  const mismatch = hasDocs && Math.abs(delta) > 1e-6;
                  return (
                    <tr key={`${row.reportId || selectedReport?.id || 'machine'}-${row.code}-${index}`} className="border-b border-zinc-100 align-top hover:bg-zinc-50">
                      {multiMachineMode ? <td className="px-3 py-2 font-semibold">{row.machine || '—'}</td> : null}
                      <td className="px-3 py-2 font-mono font-bold text-zinc-900">{row.code}</td>
                      <td className="px-3 py-2"><div className="font-semibold">{row.name || '—'}</div>{row.productionName && row.productionName !== row.name ? <div className="mt-0.5 text-[11px] text-zinc-500">{row.productionName}</div> : null}</td>
                      <td className="px-3 py-2">{row.unit || '—'}</td>
                      <td className="px-3 py-2 text-right font-black tabular-nums">{formatQty(row.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
                        {hasDocs ? formatQty(recon?.remainingByDocs ?? 0) : '—'}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${mismatch ? 'text-amber-800' : 'text-zinc-600'}`}>
                        {hasDocs ? formatQty(delta) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.sourceGroups.length ? <div className="space-y-1">{row.sourceGroups.map(group => (
                          <div key={group.key} className="tabular-nums">
                            <span className="font-bold">{group.warehouse}</span><span className="text-zinc-500"> · cấp {formatQty(group.issuedQty)} · đã nhập {formatQty(group.returnedQty)} · {formatMoney(group.unitPrice, 0)}/ĐVT</span>
                          </div>
                        ))}</div> : <span className="text-zinc-600">Chưa xác định giá cấp</span>}
                      </td>
                    </tr>
                  );
                })}
                {!displayedRows.length ? <tr><td colSpan={multiMachineMode ? 8 : 7} className="px-3 py-8 text-center font-semibold text-zinc-500">Phiếu Sổ trộn chưa có dòng bàn giao NVL.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}


    </div>
  );
}

