export type MachineNvlReportKind = 'dau_ca' | 'cuoi_ca';

export type MachineNvlSavedLine = {
  stt: number;
  maNvl: string;
  tenNvl: string;
  donVi: string;
  soLuongTonCaTruoc: number | null;
  soLuongTrongMay: number | null;
  soLuongTrongBonTron: number | null;
  soLuongNlChuaTron: number | null;
  soLuongTonDinhMuc: number | null;
  soLuongTon: number;
  ghiChu: string;
};

export type MachineNvlSavedReport = {
  id: string;
  ngay: string;
  ca: string;
  gio: string;
  maMay: string;
  tenMay: string;
  nhanSu: string;
  total: number;
  note: string;
  reportKind: MachineNvlReportKind;
  lines: MachineNvlSavedLine[];
  createdAt: string;
};

export function normalizeMachineNvlReportKind(value: unknown): MachineNvlReportKind {
  const raw = String(value ?? 'dau_ca').trim().toLowerCase();
  if (raw === 'cuoi_ca' || raw === 'cuoi' || raw === 'cuoi-ca') return 'cuoi_ca';
  return 'dau_ca';
}

export function normalizeMachineNvlReports(data: unknown): MachineNvlSavedReport[] {
  if (!data || typeof data !== 'object') return [];
  const reports = (data as { reports?: unknown }).reports;
  if (!Array.isArray(reports)) return [];

  return reports
    .map((item): MachineNvlSavedReport | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const rawLines = Array.isArray(record.chi_tiet) ? record.chi_tiet : [];
      const lines = rawLines
        .map((line, index): MachineNvlSavedLine | null => {
          if (!line || typeof line !== 'object') return null;
          const detail = line as Record<string, unknown>;
          const maNvl = String(detail.ma_nvl ?? detail.ma_npl ?? detail.code ?? '').trim();
          const tenNvl = String(detail.ten_nvl ?? detail.ten_npl ?? detail.name ?? '').trim();
          if (!maNvl && !tenNvl) return null;
          const amount = Number(String(detail.so_luong_ton ?? detail.so_luong ?? detail.quantity ?? 0).replace(',', '.'));
          const standardRaw =
            detail.so_luong_ton_dinh_muc ?? detail.so_luong_dinh_muc ?? detail.standardQuantity;
          const standardParsed =
            standardRaw === null || standardRaw === undefined || standardRaw === ''
              ? null
              : Number(String(standardRaw).replace(',', '.'));
          const prevRaw = detail.so_luong_ton_ca_truoc ?? detail.so_luong_ca_truoc ?? detail.previousQuantity;
          const prevParsed =
            prevRaw === null || prevRaw === undefined || prevRaw === ''
              ? null
              : Number(String(prevRaw).replace(',', '.'));
          const inMachineRaw = detail.so_luong_trong_may ?? detail.ton_trong_may ?? detail.inMachineQuantity;
          const inMachineParsed =
            inMachineRaw === null || inMachineRaw === undefined || inMachineRaw === ''
              ? null
              : Number(String(inMachineRaw).replace(',', '.'));
          const inMixerRaw = detail.so_luong_trong_bon_tron ?? detail.ton_trong_bon_tron ?? detail.inMixerQuantity;
          const inMixerParsed =
            inMixerRaw === null || inMixerRaw === undefined || inMixerRaw === ''
              ? null
              : Number(String(inMixerRaw).replace(',', '.'));
          const unblendedRaw = detail.so_luong_nl_chua_tron ?? detail.nl_chua_tron ?? detail.unblendedQuantity;
          const unblendedParsed =
            unblendedRaw === null || unblendedRaw === undefined || unblendedRaw === ''
              ? null
              : Number(String(unblendedRaw).replace(',', '.'));
          return {
            stt: Number(detail.stt ?? index + 1) || index + 1,
            maNvl,
            tenNvl,
            donVi: String(detail.don_vi ?? detail.unit ?? 'kg').trim() || 'kg',
            soLuongTonCaTruoc: Number.isFinite(prevParsed) ? prevParsed : null,
            soLuongTrongMay: Number.isFinite(inMachineParsed) ? inMachineParsed : null,
            soLuongTrongBonTron: Number.isFinite(inMixerParsed) ? inMixerParsed : null,
            soLuongNlChuaTron: Number.isFinite(unblendedParsed) ? unblendedParsed : null,
            soLuongTonDinhMuc: Number.isFinite(standardParsed) ? standardParsed : null,
            soLuongTon: Number.isFinite(amount) ? amount : 0,
            ghiChu: String(detail.ghi_chu ?? detail.note ?? '').trim()
          };
        })
        .filter((line): line is MachineNvlSavedLine => Boolean(line));

      return {
        id: String(record.id ?? '').trim(),
        ngay: String(record.ngay ?? '').slice(0, 10),
        ca: String(record.ca ?? '').trim(),
        gio: String(record.gio ?? '').trim(),
        maMay: String(record.ma_may ?? '').trim(),
        tenMay: String(record.ten_may ?? '').trim(),
        nhanSu: String(record.nhan_su ?? '').trim(),
        total: Number(record.tong_so_luong_ton ?? 0) || 0,
        note: String(record.ghi_chu ?? '').trim(),
        reportKind: normalizeMachineNvlReportKind(record.loai_bao_cao ?? record.loai ?? record.reportKind),
        lines,
        createdAt: String(record.created_at ?? '').trim()
      };
    })
    .filter((report): report is MachineNvlSavedReport => Boolean(report));
}

function isKgUnit(unit: unknown) {
  const normalized = String(unit ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilogam';
}

/** Tổng tồn đầu ca 1 dòng NVL = tồn máy + bồn trộn + NL chưa trộn (hoặc soLuongTon đã lưu). */
export function sumMachineNvlDauCaLineTotal(
  line: Pick<
    MachineNvlSavedLine,
    'donVi' | 'soLuongTon' | 'soLuongTrongMay' | 'soLuongTrongBonTron' | 'soLuongNlChuaTron'
  >
) {
  if (!isKgUnit(line.donVi)) return 0;
  if (line.soLuongTon > 0) return line.soLuongTon;
  return (
    (line.soLuongTrongMay ?? 0) + (line.soLuongTrongBonTron ?? 0) + (line.soLuongNlChuaTron ?? 0)
  );
}

/** Tổng tồn đầu ca của 1 báo cáo = tổng SL tồn các dòng (trong máy + bồn trộn + NL chưa trộn). */
export function sumMachineNvlDauCaReportTotal(report: Pick<MachineNvlSavedReport, 'reportKind' | 'total' | 'lines'>) {
  if (report.reportKind !== 'dau_ca') return 0;
  const fromLines = report.lines.reduce((sum, line) => sum + sumMachineNvlDauCaLineTotal(line), 0);
  if (fromLines > 0) return fromLines;
  return report.total > 0 ? report.total : 0;
}

/** Tổng tồn cuối ca 1 dòng NVL = SL tồn đã lưu. */
export function sumMachineNvlCuoiCaLineTotal(line: Pick<MachineNvlSavedLine, 'donVi' | 'soLuongTon'>) {
  if (!isKgUnit(line.donVi)) return 0;
  return Number.isFinite(line.soLuongTon) && line.soLuongTon > 0 ? line.soLuongTon : 0;
}

/** Tổng tồn cuối ca của 1 báo cáo = tổng SL tồn các dòng. */
export function sumMachineNvlCuoiCaReportTotal(report: Pick<MachineNvlSavedReport, 'reportKind' | 'total' | 'lines'>) {
  if (report.reportKind !== 'cuoi_ca') return 0;
  const fromLines = report.lines.reduce((sum, line) => sum + sumMachineNvlCuoiCaLineTotal(line), 0);
  if (fromLines > 0) return fromLines;
  return report.total > 0 ? report.total : 0;
}

export type MachineNvlReportMachineGroup = {
  key: string;
  maMay: string;
  tenMay: string;
  reports: MachineNvlSavedReport[];
};

export type MachineNvlReportShiftGroup = {
  ca: string;
  machines: MachineNvlReportMachineGroup[];
};

export type MachineNvlReportDateGroup = {
  ngay: string;
  shifts: MachineNvlReportShiftGroup[];
};

export function machineNvlReportMachineKey(report: MachineNvlSavedReport) {
  const maMay = report.maMay.trim();
  const tenMay = report.tenMay.trim();
  return maMay || tenMay || '-';
}

export function buildMachineNvlReportGroups(
  reports: MachineNvlSavedReport[],
  shiftOrder: (ca: string) => number = () => 999
): MachineNvlReportDateGroup[] {
  const byDate = new Map<string, Map<string, Map<string, MachineNvlSavedReport[]>>>();

  for (const report of reports) {
    const ngay = report.ngay || '-';
    const ca = report.ca || '-';
    const machineKey = machineNvlReportMachineKey(report);

    if (!byDate.has(ngay)) byDate.set(ngay, new Map());
    const byShift = byDate.get(ngay)!;
    if (!byShift.has(ca)) byShift.set(ca, new Map());
    const byMachine = byShift.get(ca)!;
    const list = byMachine.get(machineKey) ?? [];
    list.push(report);
    byMachine.set(machineKey, list);
  }

  return [...byDate.entries()]
    .map(([ngay, byShift]) => ({
      ngay,
      shifts: [...byShift.entries()]
        .map(([ca, byMachine]) => ({
          ca,
          machines: [...byMachine.entries()]
            .map(([machineKey, groupReports]) => ({
              key: `${ngay}|${ca}|${machineKey}`,
              maMay: groupReports[0]?.maMay ?? '',
              tenMay: groupReports[0]?.tenMay ?? '',
              reports: [...groupReports].sort(
                (left, right) =>
                  (right.createdAt || '').localeCompare(left.createdAt || '') ||
                  (right.gio || '').localeCompare(left.gio || '')
              )
            }))
            .sort((left, right) =>
              (left.tenMay || left.maMay || '').localeCompare(right.tenMay || right.maMay || '', 'vi')
            )
        }))
        .sort((left, right) => {
          const byShiftIndex = shiftOrder(left.ca) - shiftOrder(right.ca);
          if (byShiftIndex !== 0) return byShiftIndex;
          return left.ca.localeCompare(right.ca, 'vi');
        })
    }))
    .sort((left, right) => right.ngay.localeCompare(left.ngay));
}
