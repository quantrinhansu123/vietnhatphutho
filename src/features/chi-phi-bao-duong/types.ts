/** Chi phí sửa chữa / bảo dưỡng & vật tư sử dụng theo ngày và máy (QC). */

/** 1 dòng nội dung + giá trong 2 phần của phiếu. */
export interface CostItem {
  key: string;
  noi_dung: string;
  gia: number;
}

export interface ChiPhiBaoDuongChiTiet {
  sua_chua_items: Array<{ noi_dung: string; gia: number }>;
  vat_tu_items: Array<{ noi_dung: string; gia: number }>;
}

export interface ChiPhiBaoDuongRecord {
  id: string;
  /** Ngày phát sinh ISO YYYY-MM-DD (dòng cũ chưa có ngày thì = mùng 1 tháng). */
  ngay: string;
  thang: number;
  nam: number;
  ma_may: string;
  ten_may: string;
  chi_phi_sua_chua: number;
  sua_chua_ghi_chu: string;
  chi_phi_vat_tu: number;
  vat_tu_ghi_chu: string;
  chi_tiet?: ChiPhiBaoDuongChiTiet | null;
  nguoi_lap: string;
  created_at?: string;
  updated_at?: string;
}

export interface MachineOption {
  code: string;
  name: string;
}

/** Máy ngoài danh mục (khu vực chung / xe nâng) — luôn có trong dropdown. */
export const EXTRA_MACHINE_OPTIONS: MachineOption[] = [
  { code: 'CHUNG_CTY', name: 'Chung Cty' },
  { code: 'XE_NANG', name: 'Xe Nâng' }
];

export function fmtMoney(n: number): string {
  const v = Number(n) || 0;
  return v.toLocaleString('vi-VN');
}

export function newCostItem(): CostItem {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    noi_dung: '',
    gia: 0
  };
}

export function sumCostItems(items: Array<{ gia: number }>): number {
  return (items || []).reduce((s, it) => s + (Number(it.gia) || 0), 0);
}

/** Tách chi_tiet JSONB của 1 record thành 2 mảng dòng (fallback từ ghi chú cũ thì trả mảng rỗng). */
export function itemsOfRecord(
  record: ChiPhiBaoDuongRecord | null | undefined
): { sua: CostItem[]; vat: CostItem[] } {
  const detail = record?.chi_tiet;
  const toItems = (list: unknown): CostItem[] =>
    Array.isArray(list)
      ? list.map(it => {
          const rec = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
          return {
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            noi_dung: String(rec.noi_dung || ''),
            gia: Number(rec.gia) || 0
          };
        })
      : [];
  return {
    sua: toItems(detail?.sua_chua_items),
    vat: toItems(detail?.vat_tu_items)
  };
}

export function toDateStrLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function firstDayOfMonth(thang: number, nam: number): string {
  return `${nam}-${String(thang).padStart(2, '0')}-01`;
}

export function lastDayOfMonth(thang: number, nam: number): string {
  const last = new Date(nam, thang, 0).getDate();
  return `${nam}-${String(thang).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function totalOf(records: ChiPhiBaoDuongRecord[]): { sua: number; vat: number } {
  return {
    sua: records.reduce((s, r) => s + (Number(r.chi_phi_sua_chua) || 0), 0),
    vat: records.reduce((s, r) => s + (Number(r.chi_phi_vat_tu) || 0), 0)
  };
}

/** Gom các dòng theo máy (1 máy có thể phát sinh nhiều ngày trong kỳ). */
export function groupByMachine(records: ChiPhiBaoDuongRecord[]): ChiPhiBaoDuongRecord[] {
  const map = new Map<string, ChiPhiBaoDuongRecord>();
  for (const r of records) {
    const key = String(r.ma_may || '').trim() || String(r.ten_may || '');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r });
      continue;
    }
    prev.chi_phi_sua_chua = Number(prev.chi_phi_sua_chua) + Number(r.chi_phi_sua_chua);
    prev.chi_phi_vat_tu = Number(prev.chi_phi_vat_tu) + Number(r.chi_phi_vat_tu);
    const joinNotes = (a: string, b: string) =>
      [String(a || '').trim(), String(b || '').trim()].filter(Boolean).join('\n');
    prev.sua_chua_ghi_chu = joinNotes(prev.sua_chua_ghi_chu, r.sua_chua_ghi_chu);
    prev.vat_tu_ghi_chu = joinNotes(prev.vat_tu_ghi_chu, r.vat_tu_ghi_chu);
  }
  return [...map.values()];
}

export function prevMonthOf(thang: number, nam: number): { thang: number; nam: number } {
  if (thang <= 1) return { thang: 12, nam: nam - 1 };
  return { thang: thang - 1, nam };
}
