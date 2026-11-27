type Fields = Record<string, unknown>;

export type Movement = {
  from: Party;
  to: Party;
  ngay: string;
  qty: number;
  code: string;
  name: string;
  unit: string;
  /** Khóa đợt gắn chứng từ (dot_san_xuat_id hoặc legacy:dot_so). Rỗng = phiếu không gắn đợt. */
  dot?: string;
};
type Party = { kind: string; id: string };
export type UsageReport = {
  id: string;
  ngay: string;
  ca: string;
  ma_may?: string;
  ten_may?: string;
  updated_at?: string;
  created_at?: string;
  bang_ban_giao?: Fields[];
};

const str = (value: unknown) => String(value ?? '').trim();
export const fold = (value: unknown) =>
  str(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');

/** Khóa đợt ổn định từ header phiếu — ưu tiên UUID đợt, fallback legacy theo số đợt. */
export function slipDotKey(header: Fields): string {
  const id = str(header.dot_san_xuat_id);
  if (id) return id;
  if (header.dot_so != null && str(header.dot_so) !== '') return `legacy:${str(header.dot_so)}`;
  return '';
}

export function movementOf(header: Fields, line: Fields): Movement {
  const outbound = header.loai === 'xuat';
  const returnSlip = fold(header.loai_xuat) === 'nhap lai tu may vao kho';
  const legacyOutboundMachineDest =
    outbound && !str(line.src_loai) && !str(line.dich_dong_loai) && fold(line.nguon_dong_loai) === 'may';
  const from = {
    kind: str(
      line.src_loai ||
        (returnSlip ? 'may' : outbound ? header.nguon_loai : line.nguon_dong_loai || header.nguon_loai)
    ),
    id: str(
      line.src_id ||
        line.src_ten ||
        (returnSlip ? line.may : '') ||
        (outbound ? header.nguon_id : line.nguon_dong_id || header.nguon_id)
    )
  };
  const to = outbound
    ? {
        kind: str(
          line.dich_dong_loai ||
            (legacyOutboundMachineDest ? 'may' : returnSlip ? 'kho' : header.dich_loai) ||
            'kho'
        ),
        id: str(
          line.dich_dong_id ||
            (legacyOutboundMachineDest ? line.nguon_dong_id : '') ||
            line.kho_dong_id ||
            line.kho_dong_ten ||
            header.dich_id ||
            header.kho_dich
        )
      }
    : {
        kind: str(header.dich_loai || 'kho'),
        id: str(line.kho_dong_id || line.kho_dong_ten || header.dich_id || header.kho_dich)
      };
  return {
    from,
    to,
    ngay: str(header.ngay).slice(0, 10),
    qty: Number(line.so_luong) || 0,
    code: str(line.ma_hang),
    name: str(line.ten_nvl_sx || line.ten_hang),
    unit: fold(line.don_vi || 'kg'),
    dot: slipDotKey(header)
  };
}

export type Balance = {
  code: string;
  name: string;
  unit: string;
  opening: number;
  inbound: number;
  outbound: number;
  used: number | null;
  closing: number | null;
};

export type ScopeBalanceResult = {
  rows: Balance[];
  duplicateShifts: number;
  /** true khi tồn chỉ tính từ chứng từ (không trừ sổ trộn) — dùng khi lọc đợt. */
  usageExcluded?: boolean;
};

export type ScopeBalanceOptions = {
  /**
   * Bỏ sử dụng sổ trộn khỏi tồn.
   * Dùng khi lọc đợt: sổ trộn không gắn đợt nên không đủ bằng chứng để trừ sử dụng.
   * closing = opening + inbound − outbound.
   */
  excludeUsage?: boolean;
};

export function scopeBalance(
  movements: Movement[],
  reports: UsageReport[],
  from: string,
  inScope: (party: Party) => boolean,
  machineKey: (machine: string) => string,
  to?: string,
  options?: ScopeBalanceOptions
): ScopeBalanceResult {
  const balances = new Map<string, Balance>();
  const uncertain = new Set<string>();
  const usageSeen = new Set<string>();
  const excludeUsage = Boolean(options?.excludeUsage);
  const materialKey = (code: string, name: string, unit: string) =>
    JSON.stringify([fold(code), fold(name), unit]);
  const get = (code: string, name: string, unit: string) => {
    const key = materialKey(code, name, unit);
    let balance = balances.get(key);
    if (!balance) {
      balance = { code, name, unit, opening: 0, inbound: 0, outbound: 0, used: 0, closing: null };
      balances.set(key, balance);
    }
    return balance;
  };
  const issued = new Set<string>();
  const issueKey = (machine: string, key: string) => JSON.stringify([machineKey(machine), key]);
  for (const event of movements) {
    if (to && event.ngay > to) continue;
    const input = inScope(event.to);
    const output = inScope(event.from);
    const key = materialKey(event.code, event.name, event.unit);
    if (input && fold(event.to.kind) === 'may') issued.add(issueKey(event.to.id, key));
    if (input === output) continue;
    const row = get(event.code, event.name, event.unit);
    if (event.ngay < from) row.opening += input ? event.qty : -event.qty;
    else if (input) row.inbound += event.qty;
    else row.outbound += event.qty;
  }

  let duplicateShifts = 0;
  if (!excludeUsage) {
    const shifts = new Map<string, UsageReport>();
    let consideredReports = 0;
    for (const report of reports) {
      if (to && report.ngay > to) continue;
      consideredReports += 1;
      const key = JSON.stringify([
        machineKey(report.ma_may || report.ten_may || ''),
        report.ngay,
        fold(report.ca)
      ]);
      const existing = shifts.get(key);
      const rank = (item: UsageReport) => (item.updated_at || item.created_at || '') + '|' + item.id;
      if (!existing || rank(report) > rank(existing)) shifts.set(key, report);
    }
    duplicateShifts = consideredReports - shifts.size;
    for (const report of shifts.values()) {
      const machine = { kind: 'may', id: report.ma_may || report.ten_may || '' };
      if (!inScope(machine)) continue;
      for (const line of Array.isArray(report.bang_ban_giao) ? report.bang_ban_giao : []) {
        const code = str(line.ma_nvl);
        if (!code) continue;
        const name = str(line.ten_nvl_sx || line.ten_nvl);
        const unit = fold(line.dvt || line.don_vi || 'kg');
        const key = materialKey(code, name, unit);
        const row = get(code, name, unit);
        usageSeen.add(issueKey(machine.id, key));
        const raw = line.tong_su_dung;
        if (raw == null || raw === '' || !Number.isFinite(Number(raw))) {
          uncertain.add(key);
          if (report.ngay >= from) row.used = null;
        } else if (report.ngay < from) row.opening -= Number(raw);
        else if (row.used !== null) row.used += Number(raw);
      }
    }
    for (const encoded of issued) {
      if (usageSeen.has(encoded)) continue;
      const [, key] = JSON.parse(encoded) as [string, string];
      uncertain.add(key);
      const row = balances.get(key);
      if (row) row.used = null;
    }
  } else {
    for (const row of balances.values()) row.used = null;
  }

  for (const [key, row] of balances) {
    if (excludeUsage || !uncertain.has(key)) {
      row.closing = row.opening + row.inbound - row.outbound - (excludeUsage ? 0 : (row.used ?? 0));
    }
  }
  return { rows: [...balances.values()], duplicateShifts, usageExcluded: excludeUsage || undefined };
}

/** Đối chiếu tồn vật lý (sổ trộn) với phần còn lại theo chứng từ cấp/nhập lại. */
export type PhysicalReconcileInput = {
  code: string;
  name?: string;
  physical: number;
  issued: number;
  returned: number;
};

export type PhysicalReconcileRow = PhysicalReconcileInput & {
  remainingByDocs: number;
  delta: number;
};

export function reconcilePhysicalStock(rows: PhysicalReconcileInput[]): PhysicalReconcileRow[] {
  return rows.map(row => {
    const remainingByDocs = Math.round((row.issued - row.returned) * 1000) / 1000;
    const physical = Math.round(row.physical * 1000) / 1000;
    return {
      ...row,
      physical,
      remainingByDocs,
      delta: Math.round((physical - remainingByDocs) * 1000) / 1000
    };
  });
}
