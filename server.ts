import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import { ProductionReport } from './src/types';

dotenv.config();

const DB_FILE_PATH = path.join(process.cwd(), 'reports-db.json');
const WEIGHING_DB_FILE_PATH = path.join(process.cwd(), 'phieu-can-dinh-ki-db.json');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'reports';
const SUPABASE_WEIGHING_TABLE = process.env.SUPABASE_WEIGHING_TABLE || 'phieu_can_dinh_ki';
const SUPABASE_PRODUCTS_TABLE = process.env.SUPABASE_PRODUCTS_TABLE || 'san_pham';
const SUPABASE_MACHINES_TABLE = process.env.SUPABASE_MACHINES_TABLE || 'danh_sach_may';
const SUPABASE_MATERIALS_TABLE = process.env.SUPABASE_MATERIALS_TABLE || 'kho_nvl';
const SUPABASE_STAFF_TABLE = process.env.SUPABASE_STAFF_TABLE || 'nhan_su';
const SUPABASE_ORDERS_TABLE = process.env.SUPABASE_ORDERS_TABLE || 'don_hang';
const SUPABASE_CUSTOMERS_TABLE = process.env.SUPABASE_CUSTOMERS_TABLE || 'khach_hang';
const SUPABASE_SETTINGS_TABLE = process.env.SUPABASE_SETTINGS_TABLE || 'cai_dat_thoi_gian';
const SUPABASE_PRODUCTION_ORDERS_TABLE = process.env.SUPABASE_PRODUCTION_ORDERS_TABLE || 'lenh_sx';
const SUPABASE_WAREHOUSE_MOVEMENTS_TABLE = process.env.SUPABASE_WAREHOUSE_MOVEMENTS_TABLE || 'phieu_xuat_nhap_kho';
const SUPABASE_STAFF_DEPARTMENT = process.env.SUPABASE_STAFF_DEPARTMENT || 'Sản xuất';
const SUPABASE_STAFF_BRANCH = process.env.SUPABASE_STAFF_BRANCH || 'Đà Nẵng';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim();

const SUPABASE_FETCH_TIMEOUT_MS = 30_000;
const SUPABASE_FETCH_RETRIES = 3;

function isSupabaseNetworkError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('abort')
  );
}

async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempt = 1
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: init?.signal ?? controller.signal });
  } catch (error) {
    if (attempt < SUPABASE_FETCH_RETRIES && isSupabaseNetworkError(error)) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return fetchWithTimeoutAndRetry(input, init, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { fetch: fetchWithTimeoutAndRetry }
    })
  : null;
const useSupabase = Boolean(supabase);
const usingServiceKey = Boolean(process.env.SUPABASE_SERVICE_KEY);
if (useSupabase) {
  console.log('[SUPABASE] Connected to', SUPABASE_URL, 'tables', {
    reports: SUPABASE_TABLE,
    weighing: SUPABASE_WEIGHING_TABLE,
    products: SUPABASE_PRODUCTS_TABLE,
    machines: SUPABASE_MACHINES_TABLE,
    materials: SUPABASE_MATERIALS_TABLE,
    staff: SUPABASE_STAFF_TABLE,
    orders: SUPABASE_ORDERS_TABLE,
    customers: SUPABASE_CUSTOMERS_TABLE,
    settings: SUPABASE_SETTINGS_TABLE,
    productionOrders: SUPABASE_PRODUCTION_ORDERS_TABLE,
    warehouseMovements: SUPABASE_WAREHOUSE_MOVEMENTS_TABLE,
    key: usingServiceKey ? 'service_role' : 'anon/public'
  });
} else {
  console.log('[SUPABASE] Not configured; using local JSON fallback.');
}

function getSeedReports(): ProductionReport[] {
  return [
    {
      id: 'rep_seed_1',
      date: '2026-06-20',
      shiftInfo: {
        machineId: 'MÁY SX-01 (Đùn PE)',
        shiftName: 'Ca 12C1 (08:00 - 20:00)',
        operatorName: 'Nguyễn Văn Hùng',
        assistantName: 'Trần Minh Tâm'
      },
      productEntry: {
        productCode: 'PE-LD100',
        rolls: 12,
        actualWeight: 295.5
      },
      materials: {
        virginPlastic: [100, 100],
        recycledPlastic: [50, 50],
        brightenerPowder: [1.5],
        dispersionOil: [0.5],
        otherAdditives: [0.3]
      },
      wasteWeight: 3.2,
      notes: 'Vận hành ổn định, màng PE bóng dẻo đạt chuẩn. Hao hụt cắt biên mỏng.',
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rep_seed_2',
      date: '2026-06-21',
      shiftInfo: {
        machineId: 'MÁY SX-02 (Đùn PE)',
        shiftName: 'Ca 12C2 (20:00 - 08:00)',
        operatorName: 'Lê Hoàng Hải',
        assistantName: 'Phan Thanh Bình'
      },
      productEntry: {
        productCode: 'PE-HD200',
        rolls: 8,
        actualWeight: 402.0
      },
      materials: {
        virginPlastic: [150, 150],
        recycledPlastic: [55, 50],
        brightenerPowder: [2.0],
        dispersionOil: [0.8],
        otherAdditives: [0.5]
      },
      wasteWeight: 2.5,
      notes: 'Chạy cuộn PE-HD200 dày dặn, tỷ lệ trộn nhựa tái sinh tăng nhẹ nhưng màng dai đạt chuẩn.',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'rep_seed_3',
      date: '2026-06-22',
      shiftInfo: {
        machineId: 'MÁY SX-03 (Dệt PP)',
        shiftName: 'Ca 12C1 (08:00 - 20:00)',
        operatorName: 'Nguyễn Văn Hùng',
        assistantName: 'Trần Minh Tâm'
      },
      productEntry: {
        productCode: 'PP-Y101',
        rolls: 10,
        actualWeight: 388.0
      },
      materials: {
        virginPlastic: [180, 170],
        recycledPlastic: [25, 25],
        brightenerPowder: [3.0],
        dispersionOil: [1.0],
        otherAdditives: [1.2]
      },
      wasteWeight: 10.5,
      notes: 'Một số cuộn lỗi phế phẩm đầu mẩu do nhiệt độ đầu đùn chưa đều nửa đầu ca, đã căn chỉnh lại.',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    }
  ];
}

async function getReportsFromDb(): Promise<ProductionReport[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from<ProductionReport>(SUPABASE_TABLE)
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          console.warn(`[SUPABASE] Bảng ${SUPABASE_TABLE} chưa tồn tại — dùng file local. Chạy supabase-reports.sql.`);
        } else {
          console.error('Lỗi khi truy vấn Supabase:', error);
        }
      } else if (data) {
        return data;
      }
    } catch (error) {
      console.error('Lỗi khi truy vấn Supabase:', error);
    }
  }

  return getReportsFromLocalFile();
}

async function saveReportsToDb(reports: ProductionReport[]): Promise<boolean> {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(reports, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu file CSDL:', error);
    return false;
  }
}

function normalizeWeighTime(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, '').replace(/\./g, ':');
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function emptyToNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseOptionalInt(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function buildDbRecordFromClientRow(row: Record<string, unknown>, payload?: Record<string, unknown>) {
  const weighNo = emptyToNull(row.weighNo);
  const weighTime = normalizeWeighTime(String(row.weighTime ?? ''));

  return {
    document_no: emptyToNull(payload?.documentNo || row.documentNo),
    report_date: payload?.reportDate || row.reportDate || new Date().toISOString().split('T')[0],
    ngay_san_xuat:
      row.productionDate ||
      payload?.productionDate ||
      payload?.reportDate ||
      new Date().toISOString().split('T')[0],
    ca_san_xuat: emptyToNull(row.shiftName || payload?.shiftName),
    ten_cn_1: emptyToNull(row.worker1 || payload?.worker1),
    ten_cn_2: emptyToNull(row.worker2 || payload?.worker2),
    ten_nguoi_can: emptyToNull(row.weigherName || payload?.weigherName),
    ma_san_pham: emptyToNull(row.productCode),
    ten_san_pham: emptyToNull(row.productName),
    trong_luong_loi: emptyToNull(row.coreWeight),
    anh_trong_luong_loi_url: emptyToNull(row.coreWeightImageUrl),
    anh_trong_luong_loi_public_id: emptyToNull(row.coreWeightImagePublicId),
    ten_may_san_xuat: emptyToNull(row.machineName),
    lan_can: parseOptionalInt(weighNo),
    gio_can: weighTime || normalizeWeighTime(new Date().toTimeString().slice(0, 5)),
    trong_luong: emptyToNull(row.weight),
    anh_url: emptyToNull(row.imageUrl),
    anh_public_id: emptyToNull(row.imagePublicId)
  };
}

function mapWeighingRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    documentNo: String(row.document_no ?? '').trim(),
    reportDate: String(row.report_date ?? '').trim(),
    productionDate: String(row.ngay_san_xuat ?? '').trim(),
    shiftName: String(row.ca_san_xuat ?? '').trim(),
    worker1: String(row.ten_cn_1 ?? '').trim(),
    worker2: String(row.ten_cn_2 ?? '').trim(),
    weigherName: String(row.ten_nguoi_can ?? row.weigherName ?? '').trim(),
    productCode: String(row.ma_san_pham ?? '').trim(),
    productName: String(row.ten_san_pham ?? '').trim(),
    machineName: String(row.ten_may_san_xuat ?? '').trim(),
    weighNo: String(row.lan_can ?? '').trim(),
    weighTime: String(row.gio_can ?? '').trim(),
    coreWeight: String(row.trong_luong_loi ?? '').trim(),
    weight: String(row.trong_luong ?? '').trim(),
    imageUrl: String(row.anh_url ?? '').trim() || undefined,
    coreWeightImageUrl: String(row.anh_trong_luong_loi_url ?? '').trim() || undefined,
    createdAt: String(row.created_at ?? '').trim() || undefined
  };
}

function getWeighingReportsFromLocal(): ReturnType<typeof mapWeighingRow>[] {
  try {
    if (!fs.existsSync(WEIGHING_DB_FILE_PATH)) return [];

    const saved = JSON.parse(fs.readFileSync(WEIGHING_DB_FILE_PATH, 'utf-8'));
    if (!Array.isArray(saved)) return [];

    return saved.flatMap((entry: any) => {
      const rows = Array.isArray(entry?.rows) ? entry.rows : [];
      return rows.map((row: Record<string, unknown>) =>
        mapWeighingRow({
          ...row,
          document_no: row.document_no ?? entry.documentNo ?? entry.document_no,
          report_date: row.report_date ?? entry.reportDate ?? entry.report_date,
          ngay_san_xuat: row.ngay_san_xuat ?? row.productionDate ?? entry.productionDate ?? entry.ngay_san_xuat,
          ca_san_xuat: row.ca_san_xuat ?? row.shiftName ?? entry.shiftName ?? entry.ca_san_xuat,
          ten_cn_1: row.ten_cn_1 ?? row.worker1 ?? entry.worker1 ?? entry.ten_cn_1,
          ten_cn_2: row.ten_cn_2 ?? row.worker2 ?? entry.worker2 ?? entry.ten_cn_2,
          ten_nguoi_can: row.ten_nguoi_can ?? row.weigherName ?? entry.weigherName ?? entry.ten_nguoi_can,
          created_at: row.created_at ?? entry.created_at
        })
      );
    });
  } catch (error) {
    console.error('Lỗi khi đọc phiếu cân local:', error);
    return [];
  }
}

async function saveWeighingReportToLocal(report: any): Promise<boolean> {
  try {
    const current = fs.existsSync(WEIGHING_DB_FILE_PATH)
      ? JSON.parse(fs.readFileSync(WEIGHING_DB_FILE_PATH, 'utf-8'))
      : [];
    current.unshift(report);
    fs.writeFileSync(WEIGHING_DB_FILE_PATH, JSON.stringify(current, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu phiếu cân local:', error);
    return false;
  }
}

async function insertWeighingRecords(records: Record<string, unknown>[]) {
  if (!supabase) {
    return { ok: false as const, error: { message: 'Supabase chưa được cấu hình.' } };
  }

  let lastError: { message?: string; code?: string } | null = null;

  for (let attempt = 1; attempt <= SUPABASE_FETCH_RETRIES; attempt++) {
    const { data, error } = await supabase.from(SUPABASE_WEIGHING_TABLE).insert(records).select('*');
    if (!error) {
      return { ok: true as const, data: data || [] };
    }

    lastError = error;
    if (!isSupabaseNetworkError(error) || attempt === SUPABASE_FETCH_RETRIES) {
      break;
    }

    console.warn(`Supabase insert retry ${attempt}/${SUPABASE_FETCH_RETRIES}:`, error.message);
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }

  return { ok: false as const, error: lastError };
}

function readWeighingLocalEntries(): any[] {
  try {
    if (!fs.existsSync(WEIGHING_DB_FILE_PATH)) return [];
    const saved = JSON.parse(fs.readFileSync(WEIGHING_DB_FILE_PATH, 'utf-8'));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error('Lỗi khi đọc phiếu cân local:', error);
    return [];
  }
}

function writeWeighingLocalEntries(entries: any[]) {
  fs.writeFileSync(WEIGHING_DB_FILE_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

function parseWeighingId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function isLocalWeighingId(id: string) {
  return id.startsWith('local_');
}

function findLocalWeighingRow(id: string) {
  const entries = readWeighingLocalEntries();

  for (const entry of entries) {
    const rows = Array.isArray(entry?.rows) ? entry.rows : [];
    const index = rows.findIndex(
      (row: Record<string, unknown>) => String(row.id) === id || String(row.dbId) === id
    );
    if (index >= 0) {
      return { entries, entry, rows, index };
    }
  }

  return null;
}

function updateWeighingRecordLocal(id: string, record: Record<string, unknown>) {
  const found = findLocalWeighingRow(id);
  if (!found) return false;

  const dbFields = {
    document_no: record.document_no,
    report_date: record.report_date,
    ngay_san_xuat: record.ngay_san_xuat,
    ca_san_xuat: record.ca_san_xuat,
    ten_cn_1: record.ten_cn_1,
    ten_cn_2: record.ten_cn_2,
    ten_nguoi_can: record.ten_nguoi_can,
    ma_san_pham: record.ma_san_pham,
    ten_san_pham: record.ten_san_pham,
    trong_luong_loi: record.trong_luong_loi,
    anh_trong_luong_loi_url: record.anh_trong_luong_loi_url,
    anh_trong_luong_loi_public_id: record.anh_trong_luong_loi_public_id,
    ten_may_san_xuat: record.ten_may_san_xuat,
    lan_can: record.lan_can,
    gio_can: record.gio_can,
    trong_luong: record.trong_luong,
    anh_url: record.anh_url,
    anh_public_id: record.anh_public_id
  };

  found.rows[found.index] = {
    ...found.rows[found.index],
    ...dbFields,
    productionDate: record.ngay_san_xuat,
    shiftName: record.ca_san_xuat,
    worker1: record.ten_cn_1,
    worker2: record.ten_cn_2,
    weigherName: record.ten_nguoi_can,
    productCode: record.ma_san_pham,
    productName: record.ten_san_pham,
    coreWeight: record.trong_luong_loi,
    coreWeightImageUrl: record.anh_trong_luong_loi_url,
    coreWeightImagePublicId: record.anh_trong_luong_loi_public_id,
    machineName: record.ten_may_san_xuat,
    weighNo: record.lan_can,
    weighTime: record.gio_can,
    weight: record.trong_luong,
    imageUrl: record.anh_url,
    imagePublicId: record.anh_public_id
  };

  writeWeighingLocalEntries(found.entries);
  return mapWeighingRow({ ...found.rows[found.index], id });
}

function deleteWeighingRecordLocal(id: string) {
  const found = findLocalWeighingRow(id);
  if (!found) return false;

  found.rows.splice(found.index, 1);
  if (found.rows.length === 0) {
    const entryIndex = found.entries.indexOf(found.entry);
    if (entryIndex >= 0) {
      found.entries.splice(entryIndex, 1);
    }
  }

  writeWeighingLocalEntries(found.entries);
  return true;
}

async function saveWeighingPayloadLocally(payload: any, rows: any[]) {
  const stamp = Date.now();
  const rowsWithIds = rows.map((row, index) => ({
    ...row,
    dbId: row.dbId || `local_${stamp}_${index}`,
    id: row.dbId || `local_${stamp}_${index}`
  }));

  const success = await saveWeighingReportToLocal({
    id: `pcdk_${stamp}_${Math.random().toString(36).substring(2, 7)}`,
    ...payload,
    rows: rowsWithIds,
    created_at: new Date().toISOString()
  });

  if (!success) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    rows: rowsWithIds.map(row => mapWeighingRow(row as Record<string, unknown>))
  };
}

async function uploadImageToCloudinary(imageDataUrl: string) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary chưa được cấu hình.');
  }

  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = 'phieu_can_dinh_ki';
  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');
  const params = new FormData();
  params.append('file', imageDataUrl);
  params.append('api_key', CLOUDINARY_API_KEY);
  params.append('timestamp', timestamp);
  params.append('folder', folder);
  params.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: params
  });

  const data = await response.json();
  if (!response.ok) {
    if (data?.error?.message?.toLowerCase().includes('invalid signature')) {
      throw new Error('Cloudinary từ chối chữ ký upload. Vui lòng kiểm tra lại CLOUDINARY_API_SECRET trong .env.');
    }
    throw new Error(data?.error?.message || 'Không thể upload ảnh lên Cloudinary.');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id
  };
}

function pickStaffName(row: Record<string, unknown>) {
  const direct = String(
    row.nhan_su ?? row.ho_ten ?? row.ten_nv ?? row.ten ?? row.ho_va_ten ?? row.ten_nhan_vien ?? ''
  ).trim();
  if (direct) return direct;

  const nameKey = Object.keys(row).find(
    key => (key === 'nhan_su' || /ten/i.test(key)) && !/phong|ban|chi|nhanh|ma_/i.test(key) && typeof row[key] === 'string'
  );
  return nameKey ? String(row[nameKey]).trim() : '';
}

function pickStaffField(row: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function mapStaffRecord(row: Record<string, unknown>) {
  const name = pickStaffName(row);
  const department = pickStaffField(row, ['phong_ban', 'phongban', 'department'], 'Chưa phân phòng ban');
  const branch = pickStaffField(row, ['chi_nhanh', 'chi_nhanh_lam_viec', 'branch', 'co_so'], 'Chưa phân chi nhánh');
  const role = pickStaffField(row, ['Cong_Viec', 'cong_viec', 'chuc_vu', 'vi_tri', 'role'], 'Nhân sự');
  const position = pickStaffField(row, ['vi_tri', 'ma_vi_tri'], '');
  const shift = pickStaffField(row, ['ca_lam', 'ca', 'shift'], 'Theo phân công');
  const status = pickStaffField(row, ['trang_thai', 'status'], 'Đang làm');
  const code = pickStaffField(row, ['ma_nhan_su', 'ma_nv', 'id'], name);

  return {
    id: code || name,
    code,
    name,
    branch,
    department,
    role,
    position,
    shift,
    status
  };
}

function buildStaffGroups(rows: Record<string, unknown>[]) {
  const staff = rows
    .map(mapStaffRecord)
    .filter(person => person.name)
    .sort((a, b) =>
      `${a.branch} ${a.department} ${a.name}`.localeCompare(`${b.branch} ${b.department} ${b.name}`, 'vi')
    );

  const branchMap = new Map<string, {
    id: string;
    name: string;
    shortName: string;
    departments: Array<{
      id: string;
      name: string;
      lead: string;
      members: typeof staff;
    }>;
  }>();

  for (const person of staff) {
    const branchId = person.branch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'branch';
    let branch = branchMap.get(person.branch);
    if (!branch) {
      branch = {
        id: branchId,
        name: person.branch,
        shortName: person.branch.replace(/^Chi nhánh\s+/i, ''),
        departments: []
      };
      branchMap.set(person.branch, branch);
    }

    let department = branch.departments.find(item => item.name === person.department);
    if (!department) {
      department = {
        id: `${branchId}-${person.department.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'department'}`,
        name: person.department,
        lead: '',
        members: []
      };
      branch.departments.push(department);
    }

    department.members.push(person);
  }

  for (const branch of branchMap.values()) {
    for (const department of branch.departments) {
      const lead =
        department.members.find(person =>
          /trưởng|quan ly|quản lý|giam doc|giám đốc|leader/i.test(`${person.role} ${person.position}`)
        ) || department.members[0];
      department.lead = lead?.name || 'Chưa phân công';
    }
  }

  return Array.from(branchMap.values());
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST204') return true;
  return /does not exist/i.test(error.message || '');
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST205') return true;
  return /could not find the table/i.test(error.message || '');
}

type ProductNplPhanTramItem = {
  ma_npl: string;
  ten_npl: string;
  loai: 'phan_tram' | 'so_luong';
  phan_tram: number | null;
  so_luong: number | null;
  don_vi: string | null;
};

function parseServerNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  return Number(normalized);
}

function resolveServerNplAmountType(record: Record<string, unknown>): 'phan_tram' | 'so_luong' {
  const loai = String(record.loai ?? record.amountType ?? record.dinh_luong_loai ?? '').trim().toLowerCase();
  if (loai === 'so_luong' || loai === 'quantity') return 'so_luong';
  if (loai === 'phan_tram' || loai === 'percent') return 'phan_tram';

  const quantityRaw = record.so_luong ?? record.quantity;
  const percentRaw = record.phan_tram ?? record.percent ?? record.ty_le;
  const quantity = parseServerNumber(quantityRaw);
  const percent = parseServerNumber(percentRaw);

  if (quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== '' && (percentRaw === undefined || percentRaw === null || percentRaw === '')) {
    return 'so_luong';
  }

  if (Number.isFinite(quantity) && !Number.isFinite(percent)) return 'so_luong';
  return 'phan_tram';
}

function parseProductNplPhanTramInput(raw: unknown): { error: string } | { items: ProductNplPhanTramItem[] } {
  let source = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { items: [] };
    }
    try {
      source = JSON.parse(trimmed);
    } catch {
      return { error: 'JSON NPL không hợp lệ.' };
    }
  }

  if (source === null || source === undefined) {
    return { items: [] };
  }

  const list = Array.isArray(source)
    ? source
    : source && typeof source === 'object' && Array.isArray((source as { items?: unknown }).items)
      ? (source as { items: unknown[] }).items
      : null;

  if (!list) {
    return { error: 'NPL phần trăm phải là mảng JSON.' };
  }

  const items: ProductNplPhanTramItem[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const maNpl = String(record.ma_npl ?? record.code ?? record.ma ?? '').trim();
    const tenNpl = String(record.ten_npl ?? record.name ?? record.ten ?? '').trim();
    const donVi = String(record.don_vi ?? record.unit ?? '').trim() || null;
    const loai = resolveServerNplAmountType(record);

    if (!maNpl) {
      return { error: 'Mỗi dòng NPL cần có mã NPL.' };
    }

    if (loai === 'so_luong') {
      const quantity = parseServerNumber(record.so_luong ?? record.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        return { error: `Số lượng của ${maNpl} phải >= 0.` };
      }
      items.push({
        ma_npl: maNpl,
        ten_npl: tenNpl,
        loai: 'so_luong',
        phan_tram: null,
        so_luong: Math.round(quantity * 100) / 100,
        don_vi: donVi
      });
      continue;
    }

    const percent = parseServerNumber(record.phan_tram ?? record.percent ?? record.ty_le);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { error: `Phần trăm của ${maNpl} phải từ 0 đến 100.` };
    }

    items.push({
      ma_npl: maNpl,
      ten_npl: tenNpl,
      loai: 'phan_tram',
      phan_tram: Math.round(percent * 100) / 100,
      so_luong: null,
      don_vi: donVi
    });
  }

  return { items };
}

function parseProductPatchBody(body: unknown): { error: string } | { record: Record<string, string | number | null> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = parseMaterialText(source.code ?? source.ma_sp);
  const name = parseMaterialText(source.name ?? source.ten_sp);
  const hasProductField = [
    'code', 'ma_sp', 'newCode', 'ma_sp_moi', 'name', 'ten_sp', 'nature', 'tinh_chat', 'group', 'nhom_vthh',
    'unit', 'don_vi', 'openingStock', 'ton_dau_ky', 'inbound', 'nhap_trong_ky', 'outbound', 'xuat_trong_ky',
    'stock', 'sl_ton', 'minStock', 'so_luong_ton_toi_thieu',
    'origin', 'nguon_goc', 'description', 'mo_ta'
  ].some(key => Object.prototype.hasOwnProperty.call(source, key));

  if (!hasProductField) {
    return { error: 'Không có dữ liệu sản phẩm để cập nhật.' };
  }

  if (!code && !name) {
    return { error: 'Vui lòng nhập mã SP hoặc tên sản phẩm.' };
  }

  const record: Record<string, string | number | null> = {};
  if (code) record.ma_sp = code;
  if (name) record.ten_sp = name;
  if (Object.prototype.hasOwnProperty.call(source, 'newCode') || Object.prototype.hasOwnProperty.call(source, 'ma_sp_moi')) {
    record.ma_sp_moi = parseMaterialText(source.newCode ?? source.ma_sp_moi) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'nature') || Object.prototype.hasOwnProperty.call(source, 'tinh_chat')) {
    record.tinh_chat = parseMaterialText(source.nature ?? source.tinh_chat) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'group') || Object.prototype.hasOwnProperty.call(source, 'nhom_vthh')) {
    record.nhom_vthh = parseMaterialText(source.group ?? source.nhom_vthh) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'unit') || Object.prototype.hasOwnProperty.call(source, 'don_vi')) {
    record.don_vi = parseMaterialText(source.unit ?? source.don_vi) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'openingStock') || Object.prototype.hasOwnProperty.call(source, 'ton_dau_ky')) {
    record.ton_dau_ky = parseOptionalMaterialNumber(source.openingStock ?? source.ton_dau_ky);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'inbound') || Object.prototype.hasOwnProperty.call(source, 'nhap_trong_ky')) {
    record.nhap_trong_ky = parseOptionalMaterialNumber(source.inbound ?? source.nhap_trong_ky);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'outbound') || Object.prototype.hasOwnProperty.call(source, 'xuat_trong_ky')) {
    record.xuat_trong_ky = parseOptionalMaterialNumber(source.outbound ?? source.xuat_trong_ky);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'stock') || Object.prototype.hasOwnProperty.call(source, 'sl_ton')) {
    record.sl_ton = parseOptionalMaterialNumber(source.stock ?? source.sl_ton);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'minStock') || Object.prototype.hasOwnProperty.call(source, 'so_luong_ton_toi_thieu')) {
    record.so_luong_ton_toi_thieu = parseOptionalMaterialNumber(source.minStock ?? source.so_luong_ton_toi_thieu);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'origin') || Object.prototype.hasOwnProperty.call(source, 'nguon_goc')) {
    record.nguon_goc = parseMaterialText(source.origin ?? source.nguon_goc) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'description') || Object.prototype.hasOwnProperty.call(source, 'mo_ta')) {
    record.mo_ta = parseMaterialText(source.description ?? source.mo_ta) || null;
  }

  return { record };
}

function productWriteErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_PRODUCTS_TABLE} chưa tồn tại trên Supabase.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_PRODUCTS_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-san-pham-npl-phan-tram.sql.`;
  }
  return `Không thể lưu sản phẩm vào ${SUPABASE_PRODUCTS_TABLE}. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

type SettingWritePayload = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  loaiCaiDat: string;
  group: string;
  note: string;
  khungGio: string;
  coreRecord: Record<string, string>;
  fullRecord: Record<string, string>;
};

function parseSettingBody(body: unknown): { error: string } | SettingWritePayload {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof source.code === 'string' ? source.code.trim() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';

  if (!code) return { error: 'Vui lòng nhập mã cài đặt.' };
  if (!name) return { error: 'Vui lòng nhập tên cài đặt.' };

  const startTime = typeof source.startTime === 'string' ? source.startTime.trim() : '';
  const endTime = typeof source.endTime === 'string' ? source.endTime.trim() : '';

  if (!startTime) return { error: 'Vui lòng chọn giờ bắt đầu.' };
  if (!endTime) return { error: 'Vui lòng chọn giờ kết thúc.' };

  const loaiCaiDat =
    typeof source.loaiCaiDat === 'string' && source.loaiCaiDat.trim()
      ? source.loaiCaiDat.trim()
      : typeof source.group === 'string' && source.group.trim()
        ? source.group.trim()
        : '';

  if (!loaiCaiDat) return { error: 'Vui lòng chọn loại cài đặt (loai_cai_dat).' };

  const group =
    typeof source.group === 'string' ? source.group.trim() || loaiCaiDat : loaiCaiDat;
  const note = typeof source.note === 'string' ? source.note.trim() : '';
  const khungGio =
    typeof source.khungGio === 'string' && source.khungGio.trim()
      ? source.khungGio.trim()
      : `${startTime} - ${endTime}`;

  const coreRecord = {
    hang_muc: name,
    loai_cai_dat: loaiCaiDat,
    khung_gio: khungGio,
    gio_bat_dau: startTime,
    gio_ket_thuc: endTime
  };

  const fullRecord = {
    ...coreRecord,
    ma_cai_dat: code,
    ten_cai_dat: name,
    nhom: group,
    ghi_chu: note
  };

  return {
    code,
    name,
    startTime,
    endTime,
    loaiCaiDat,
    group,
    note,
    khungGio,
    coreRecord,
    fullRecord
  };
}

function settingsWriteErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_SETTINGS_TABLE} chưa tồn tại. Hãy chạy file supabase-cai-dat-thoi-gian.sql trong Supabase SQL Editor.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_SETTINGS_TABLE} đang thiếu cột (${error.message}). Hãy chạy file supabase-cai-dat-thoi-gian.sql trong Supabase SQL Editor.`;
  }
  return `Không thể lưu cài đặt vào ${SUPABASE_SETTINGS_TABLE}. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

async function writeSettingRecord(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  payload: SettingWritePayload,
  id?: string
) {
  const { fullRecord, coreRecord, startTime, endTime, note } = payload;
  const write = (record: Record<string, string>) =>
    id
      ? supabase.from(SUPABASE_SETTINGS_TABLE).update(record).eq('id', id).select('*').single()
      : supabase.from(SUPABASE_SETTINGS_TABLE).insert(record).select('*').single();

  let { data, error } = await write(fullRecord);

  if (error?.code === 'PGRST204') {
    ({ data, error } = await write({
      ...coreRecord,
      gia_tri: `${startTime} - ${endTime}`,
      ghi_chu: note
    }));
  }

  if (error?.code === 'PGRST204') {
    ({ data, error } = await write(coreRecord));
  }

  return { data, error };
}

function parseOptionalMaterialNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === '-') return null;
  const num = Number(text.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function parseMaterialText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseMachineBody(body: unknown): { error: string } | { record: Record<string, string> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof source.code === 'string' ? source.code.trim() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';

  if (!code) return { error: 'Vui lòng nhập mã máy.' };
  if (!name) return { error: 'Vui lòng nhập tên máy.' };

  return {
    record: {
      ma_may: code,
      ten_may: name,
      loai_may: typeof source.type === 'string' ? source.type.trim() || 'Chưa phân loại' : 'Chưa phân loại',
      chi_nhanh: typeof source.branch === 'string' ? source.branch.trim() : '',
      vi_tri: typeof source.location === 'string' ? source.location.trim() : '',
      trang_thai: typeof source.status === 'string' ? source.status.trim() || 'Đang dùng' : 'Đang dùng',
      ghi_chu: typeof source.note === 'string' ? source.note.trim() : ''
    }
  };
}

function machineWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_MACHINES_TABLE} chưa tồn tại. Hãy chạy file supabase-danh-sach-may.sql trong Supabase SQL Editor.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_MACHINES_TABLE} đang thiếu cột. Hãy chạy file supabase-danh-sach-may.sql.`;
  }
  return `Không thể lưu máy vào ${SUPABASE_MACHINES_TABLE}. ${error.message}`;
}

function machineKeyFilters(key: string): Array<{ column: string; value: string | number }> {
  const trimmed = key.trim();
  const filters: Array<{ column: string; value: string | number }> = [];

  if (/^\d+$/.test(trimmed)) {
    filters.push({ column: 'id', value: Number(trimmed) });
  }

  filters.push({ column: 'ma_may', value: trimmed });

  if (!filters.some(filter => filter.column === 'id')) {
    filters.push({ column: 'id', value: trimmed });
  }

  return filters;
}

async function updateMachineByKey(key: string, record: Record<string, unknown>) {
  let lastError: { code?: string; message?: string } | null = null;

  for (const filter of machineKeyFilters(key)) {
    const { data, error } = await supabase!
      .from(SUPABASE_MACHINES_TABLE)
      .update(record)
      .eq(filter.column, filter.value)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      return { data, error: null };
    }

    if (error && !isMissingColumnError(error)) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
}

async function deleteMachineByKey(key: string) {
  let lastError: { code?: string; message?: string } | null = null;

  for (const filter of machineKeyFilters(key)) {
    const { data, error } = await supabase!
      .from(SUPABASE_MACHINES_TABLE)
      .delete()
      .eq(filter.column, filter.value)
      .select('ma_may')
      .maybeSingle();

    if (!error && data) {
      return { data, error: null };
    }

    if (error && !isMissingColumnError(error)) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
}

type MaterialWritePayload = {
  record: Record<string, string | number | null>;
};

function parseMaterialBody(body: unknown): { error: string } | MaterialWritePayload {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = parseMaterialText(source.code);
  const name = parseMaterialText(source.name);

  if (!code) return { error: 'Vui lòng nhập mã NPL.' };
  if (!name) return { error: 'Vui lòng nhập tên nguyên phụ liệu.' };

  const record: Record<string, string | number | null> = {
    ma_npl: code,
    ten_npl: name,
    don_vi: parseMaterialText(source.unit) || null,
    tong_trong_luong: parseOptionalMaterialNumber(source.totalWeight),
    trong_luong_nhua: parseOptionalMaterialNumber(source.plasticWeight),
    trong_luong_tui: parseOptionalMaterialNumber(source.bagWeight),
    trong_luong_loi: parseOptionalMaterialNumber(source.coreWeight),
    kho_cuon: parseOptionalMaterialNumber(source.rollWidth),
    chieu_dai_don_vi: parseOptionalMaterialNumber(source.unitLength),
    ton_dau_ky: parseOptionalMaterialNumber(source.openingStock),
    nhap_trong_ky: parseOptionalMaterialNumber(source.inbound),
    xuat_trong_ky: parseOptionalMaterialNumber(source.outbound)
  };

  return { record };
}

function materialWriteErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_MATERIALS_TABLE} chưa tồn tại trên Supabase.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_MATERIALS_TABLE} đang thiếu cột (${error.message}).`;
  }
  return `Không thể lưu nguyên phụ liệu vào ${SUPABASE_MATERIALS_TABLE}. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

type WarehouseSlipLineInput = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

function roundWarehouseMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseWarehouseSlipType(value: unknown): 'nhap' | 'xuat' | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'nhap' || normalized === 'import' || normalized === 'in') return 'nhap';
  if (normalized === 'xuat' || normalized === 'export' || normalized === 'out') return 'xuat';
  return null;
}

function parseWarehouseStorageType(value: unknown): 'nvl' | 'san_pham' | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'nvl' || normalized === 'kho_nvl' || normalized === 'material') return 'nvl';
  if (normalized === 'san_pham' || normalized === 'san-pham' || normalized === 'product' || normalized === 'sp') return 'san_pham';
  return null;
}

function parseWarehouseSlipDate(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseWarehouseSlipLines(
  raw: unknown,
  loaiKho: 'nvl' | 'san_pham'
): { error: string } | { items: WarehouseSlipLineInput[] } {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) {
    return { error: loaiKho === 'san_pham' ? 'Phiếu cần ít nhất một dòng sản phẩm.' : 'Phiếu cần ít nhất một dòng NVL.' };
  }

  const items: WarehouseSlipLineInput[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const code = String(
      record.code ??
        (loaiKho === 'san_pham' ? record.ma_sp ?? record.productCode : record.ma_npl ?? record.ma) ??
        ''
    ).trim();
    const name = String(
      record.name ??
        (loaiKho === 'san_pham' ? record.ten_sp ?? record.productName : record.ten_npl ?? record.ten) ??
        ''
    ).trim();
    const unit = String(record.unit ?? record.don_vi ?? '').trim();
    const quantity = Number(record.quantity ?? record.so_luong);
    const unitPriceRaw = record.unitPrice ?? record.don_gia ?? record.price ?? record.gia;
    const unitPrice = parseOptionalMaterialNumber(unitPriceRaw) ?? 0;

    if (!code) {
      return { error: loaiKho === 'san_pham' ? 'Mỗi dòng cần có mã sản phẩm.' : 'Mỗi dòng cần có mã NPL.' };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Số lượng của ${code} phải lớn hơn 0.` };
    }
    if (unitPrice < 0) {
      return { error: `Giá của ${code} không hợp lệ.` };
    }

    items.push({
      code,
      name,
      unit,
      quantity: roundWarehouseMoney(quantity),
      unitPrice: roundWarehouseMoney(unitPrice),
      lineAmount: roundWarehouseMoney(quantity * unitPrice)
    });
  }

  if (items.length === 0) {
    return { error: loaiKho === 'san_pham' ? 'Phiếu cần ít nhất một dòng sản phẩm hợp lệ.' : 'Phiếu cần ít nhất một dòng NVL hợp lệ.' };
  }

  return { items };
}

function parseWarehouseSlipBody(body: unknown): {
  error: string;
} | {
  loaiPhieu: 'nhap' | 'xuat';
  loaiKho: 'nvl' | 'san_pham';
  ngayPhieu: string;
  lyDo: string | null;
  ghiChu: string | null;
  nguoiLap: string | null;
  items: WarehouseSlipLineInput[];
} {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const loaiPhieu = parseWarehouseSlipType(source.loaiPhieu ?? source.loai_phieu ?? source.type);
  const loaiKho = parseWarehouseStorageType(source.loaiKho ?? source.loai_kho ?? source.kho) ?? 'nvl';
  const ngayPhieu = parseWarehouseSlipDate(source.ngayPhieu ?? source.ngay_phieu ?? source.date);
  const parsedItems = parseWarehouseSlipLines(source.items ?? source.lines ?? source.chi_tiet, loaiKho);

  if (!loaiPhieu) {
    return { error: 'Loại phiếu phải là nhập hoặc xuất.' };
  }
  if (!ngayPhieu) {
    return { error: 'Vui lòng chọn ngày phiếu hợp lệ.' };
  }
  if ('error' in parsedItems) {
    return parsedItems;
  }

  return {
    loaiPhieu,
    loaiKho,
    ngayPhieu,
    lyDo: String(source.lyDo ?? source.ly_do ?? source.reason ?? '').trim() || null,
    ghiChu: String(source.ghiChu ?? source.ghi_chu ?? source.note ?? '').trim() || null,
    nguoiLap: String(source.nguoiLap ?? source.nguoi_lap ?? source.createdBy ?? '').trim() || null,
    items: parsedItems.items
  };
}

function generateWarehouseSlipCode(loaiPhieu: 'nhap' | 'xuat') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `${loaiPhieu === 'nhap' ? 'PN' : 'PX'}-${date}-${time}`;
}

async function syncMaterialInventoryFromMovements(maNpl: string) {
  if (!supabase) return;
  const code = String(maNpl || '').trim();
  if (!code) return;

  const totals = await buildMaterialMovementTotals();
  const movement = totals.get(code) || { nhap: 0, xuat: 0 };

  const { error: updateError } = await supabase
    .from(SUPABASE_MATERIALS_TABLE)
    .update({
      nhap_trong_ky: movement.nhap,
      xuat_trong_ky: movement.xuat
    })
    .eq('ma_npl', code);

  if (updateError) {
    console.error('Supabase kho_nvl inventory sync error:', updateError);
  }
}

async function buildMaterialMovementTotals(): Promise<Map<string, { nhap: number; xuat: number }>> {
  const totals = new Map<string, { nhap: number; xuat: number }>();
  if (!supabase) return totals;

  const { data, error } = await supabase
    .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
    .select('ma_npl, loai_phieu, so_luong')
    .or('loai_kho.eq.nvl,loai_kho.is.null');

  if (error) {
    console.error('Supabase material movement totals error:', error);
    return totals;
  }

  for (const row of data || []) {
    const code = String(row.ma_npl ?? '').trim();
    if (!code) continue;
    const current = totals.get(code) || { nhap: 0, xuat: 0 };
    const qty = Number(row.so_luong);
    if (!Number.isFinite(qty)) continue;
    if (String(row.loai_phieu || '').trim().toLowerCase() === 'xuat') {
      current.xuat = roundWarehouseMoney(current.xuat + qty);
    } else {
      current.nhap = roundWarehouseMoney(current.nhap + qty);
    }
    totals.set(code, current);
  }

  return totals;
}

function applyMaterialMovementTotals<T extends Record<string, unknown>>(
  materials: T[],
  totals: Map<string, { nhap: number; xuat: number }>
) {
  return materials.map(material => {
    const code = String(material.ma_npl ?? '').trim();
    const movement = totals.get(code);
    if (!movement) return material;
    return {
      ...material,
      nhap_trong_ky: movement.nhap,
      xuat_trong_ky: movement.xuat
    };
  });
}

function warehouseSlipWriteErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_WAREHOUSE_MOVEMENTS_TABLE} chưa tồn tại trên Supabase. Hãy chạy supabase-phieu-xuat-nhap-kho.sql.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_WAREHOUSE_MOVEMENTS_TABLE} đang thiếu cột (${error.message}).`;
  }
  return `Không thể lưu phiếu xuất nhập kho. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

function parseOrderQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOrderBody(
  body: unknown,
  options?: { isCreate?: boolean }
): { error: string } | { record: Record<string, string | number | null> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const orderCode = typeof source.orderCode === 'string' ? source.orderCode.trim() : '';
  const productCode = typeof source.productCode === 'string' ? source.productCode.trim() : '';
  const productName = typeof source.productName === 'string' ? source.productName.trim() : '';

  if (!orderCode) return { error: 'Vui lòng nhập mã đơn hàng.' };
  if (!productCode && !productName) return { error: 'Vui lòng nhập mã hàng hoặc tên hàng.' };

  const DEFAULT_ORDER_STATUS = 'Chờ sx';
  const status = options?.isCreate
    ? DEFAULT_ORDER_STATUS
    : typeof source.status === 'string' && source.status.trim()
      ? source.status.trim()
      : DEFAULT_ORDER_STATUS;

  const record: Record<string, string | number | null> = {
    ma_don_hang: orderCode,
    loai_don_hang: typeof source.orderType === 'string' ? source.orderType.trim() : '',
    trang_thai: status,
    nhan_vien: typeof source.staffName === 'string' ? source.staffName.trim() : '',
    khach_hang: typeof source.customer === 'string' ? source.customer.trim() : '',
    ma_hang: productCode,
    ten_hang: productName,
    don_vi: typeof source.unit === 'string' ? source.unit.trim() : '',
    so_luong: parseOrderQuantity(source.quantity),
    so_luong_ton: parseOrderQuantity(source.stockQuantity),
    lenh_sx: typeof source.productionOrder === 'string' ? source.productionOrder.trim() : '',
    ghi_chu: typeof source.note === 'string' ? source.note.trim() : ''
  };

  return { record };
}

function orderWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_ORDERS_TABLE} chưa tồn tại trong Supabase.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_ORDERS_TABLE} đang thiếu cột.`;
  }
  return `Không thể lưu đơn hàng vào ${SUPABASE_ORDERS_TABLE}. ${error.message}`;
}

const DEFAULT_PRODUCTION_ORDER_STATUS = 'Chờ sx';
const DEFAULT_PRODUCTION_WORKERS = 'Chưa phân công';
const DEFAULT_PRODUCTION_CREATOR = 'Hệ thống';

function pickRowField(row: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function makeProductionOrderCode(orderCode: string, suffix = '') {
  const base = (orderCode || 'DH').replace(/\s+/g, '-');
  return `LSX-${base}${suffix}`.slice(0, 80);
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function productionOrderProductLabel(productCode: string, productName: string) {
  if (productName && productCode) return `${productCode} · ${productName}`;
  return productName || productCode || '-';
}

function buildProductionOrderRecordFromOrder(
  order: Record<string, unknown>,
  code: string
): Record<string, string | number | null> {
  const orderCode = pickRowField(order, ['ma_don_hang', 'order_code', 'code']);
  const productCode = pickRowField(order, ['ma_hang', 'ma_sp']);
  const productName = pickRowField(order, ['ten_hang', 'ten_sp']);
  const customer = pickRowField(order, ['khach_hang', 'customer']);
  const unit = pickRowField(order, ['don_vi', 'unit']);
  const workers =
    pickRowField(order, ['cong_nhan', 'nhan_su', 'nhan_vien', 'staff'], '') || DEFAULT_PRODUCTION_WORKERS;
  const creator =
    pickRowField(order, ['nguoi_tao', 'created_by', 'nguoi_lap', 'nhan_vien', 'staff'], '') || DEFAULT_PRODUCTION_CREATOR;

  return {
    ma_lenh_sx: code,
    ten_lenh_sx: productName ? `SX ${productName}` : `Lệnh SX ${orderCode || code}`,
    ma_hang: productCode,
    ten_hang: productName,
    san_pham: productionOrderProductLabel(productCode, productName),
    so_luong: parseOrderQuantity(order.so_luong ?? order.quantity),
    don_vi: unit,
    trang_thai: DEFAULT_PRODUCTION_ORDER_STATUS,
    khach_hang: customer,
    cong_nhan: workers,
    nhan_su: workers,
    nguoi_tao: creator,
    ma_don_hang: orderCode,
    ngay_bat_dau: todayDateString(),
    ghi_chu: pickRowField(order, ['ghi_chu', 'note'])
  };
}

function parseProductionOrderBody(
  body: unknown
): { error: string } | { record: Record<string, string | number | null> } {
  if (!body || typeof body !== 'object') {
    return { error: 'Dữ liệu không hợp lệ.' };
  }

  const source = body as Record<string, unknown>;
  const productCode = pickRowField(source, ['ma_hang', 'productCode', 'ma_sp'], '');
  const productName = pickRowField(source, ['ten_hang', 'productName', 'ten_sp'], '');
  if (!productCode && !productName) {
    return { error: 'Cần nhập mã hàng hoặc tên hàng.' };
  }

  const quantity = parseOrderQuantity(source.so_luong ?? source.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'Số lượng phải lớn hơn 0.' };
  }

  const orderRef = pickRowField(source, ['ma_don_hang', 'orderRef', 'order_code'], '');
  const manualSeed = `MAN-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const codeInput = pickRowField(source, ['ma_lenh_sx', 'code'], '');
  const code = codeInput || makeProductionOrderCode(orderRef || manualSeed);
  const name = pickRowField(source, ['ten_lenh_sx', 'name'], '');
  const startDateTime = pickRowField(
    source,
    ['ngay_gio_bat_dau', 'startDateTime', 'ngay_bat_dau', 'startDate'],
    ''
  );
  const endDateTime = pickRowField(
    source,
    ['ngay_gio_ket_thuc', 'endDateTime', 'ngay_ket_thuc', 'endDate'],
    ''
  );
  const startDateOnly = startDateTime ? startDateTime.slice(0, 10) : todayDateString();
  const endDateOnly = endDateTime ? endDateTime.slice(0, 10) : '';
  const workers =
    pickRowField(source, ['cong_nhan', 'nhan_su', 'staff', 'nhan_vien'], '') || DEFAULT_PRODUCTION_WORKERS;
  const creator =
    pickRowField(source, ['nguoi_tao', 'created_by', 'nguoi_lap', 'staff', 'nhan_vien'], '') || DEFAULT_PRODUCTION_CREATOR;
  const productLabel =
    pickRowField(source, ['san_pham', 'product'], '') || productionOrderProductLabel(productCode, productName);

  return {
    record: {
      ma_lenh_sx: code,
      ten_lenh_sx: name || (productName ? `SX ${productName}` : `Lệnh SX ${code}`),
      ma_hang: productCode,
      ten_hang: productName,
      san_pham: productLabel,
      so_luong: quantity,
      don_vi: pickRowField(source, ['don_vi', 'unit'], ''),
      trang_thai: pickRowField(source, ['trang_thai', 'status'], DEFAULT_PRODUCTION_ORDER_STATUS),
      ma_don_hang: orderRef,
      ca: pickRowField(source, ['ca', 'shift'], ''),
      cong_nhan: workers,
      nhan_su: workers,
      nguoi_tao: creator,
      ngay_gio_bat_dau: startDateTime || null,
      ngay_gio_ket_thuc: endDateTime || null,
      ngay_bat_dau: startDateOnly,
      ngay_ket_thuc: endDateOnly || null,
      may: pickRowField(source, ['may', 'machine'], ''),
      ghi_chu: pickRowField(source, ['ghi_chu', 'note'], '')
    }
  };
}

async function ensureUniqueProductionOrderCode(initialCode: string) {
  if (!supabase) return initialCode;

  let code = initialCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: duplicate } = await supabase
      .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
      .select('id')
      .eq('ma_lenh_sx', code)
      .maybeSingle();

    if (!duplicate) return code;
    code = makeProductionOrderCode(
      initialCode.replace(/^LSX-/, ''),
      `-${Date.now().toString(36).slice(-4)}`
    );
  }

  return code;
}

function productionOrderWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_PRODUCTION_ORDERS_TABLE} chưa tồn tại. Hãy chạy file supabase-lenh-sx.sql trong Supabase SQL Editor.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_PRODUCTION_ORDERS_TABLE} đang thiếu cột. Hãy chạy file supabase-lenh-sx.sql.`;
  }
  return `Không thể lưu lệnh sản xuất vào ${SUPABASE_PRODUCTION_ORDERS_TABLE}. ${error.message}`;
}

async function getReportsFromLocalFile(): Promise<ProductionReport[]> {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const seedReports = getSeedReports();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seedReports, null, 2), 'utf-8');
      return seedReports;
    }

    const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent) as ProductionReport[];
  } catch (error) {
    console.error('Lỗi khi đọc file CSDL:', error);
    return getSeedReports();
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3001;

  app.use(express.json({ limit: '12mb' }));

  // API Route: Get all reports
  app.get('/api/reports', async (_req, res) => {
    try {
      const list = await getReportsFromDb();
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json(list);
    } catch (err: any) {
      console.error('GET /api/reports error:', err);
      const fallback = await getReportsFromLocalFile();
      res.json(fallback);
    }
  });

  app.post('/api/reports', async (req, res) => {
    try {
      const reportData = req.body;
      
      if (!reportData.date || !reportData.shiftInfo || !reportData.productEntry) {
        return res.status(400).json({ error: 'Yêu cầu điền đầy đủ dữ liệu bắt buộc!' });
      }

      const newReport: ProductionReport = {
        ...reportData,
        id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString()
      };

      if (supabase) {
        const { data, error } = await supabase
          .from<ProductionReport>(SUPABASE_TABLE)
          .insert(newReport)
          .select()
          .single();

        if (!error && data) {
          return res.status(201).json(data);
        }

        if (error) {
          if (isMissingTableError(error)) {
            console.warn(`[SUPABASE] Bảng ${SUPABASE_TABLE} chưa tồn tại — lưu file local. Chạy supabase-reports.sql.`);
          } else {
            console.error('Supabase insert error:', error);
          }
        }
      }

      const list = await getReportsFromDb();
      list.push(newReport);
      const success = await saveReportsToDb(list);

      if (success) {
        res.status(201).json(newReport);
      } else {
        res.status(500).json({ error: 'Không thể ghi lưu báo cáo mới vào cơ sở dữ liệu!' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi hệ thống không xác định' });
    }
  });

  app.get('/api/san-pham', async (req, res) => {
    if (!supabase) {
      return res.json([]);
    }

    try {
      const format = typeof req.query.format === 'string' ? req.query.format : 'list';
      if (format === 'table') {
        const { data, error } = await supabase
          .from(SUPABASE_PRODUCTS_TABLE)
          .select('*')
          .order('ten_sp', { ascending: true });

        if (error) {
          console.error('Supabase san_pham table query error:', error);
          return res.status(500).json({
            error: `Không thể tải bảng sản phẩm từ ${SUPABASE_PRODUCTS_TABLE}. ${error.message}`
          });
        }

        return res.json({
          products: data || [],
          total: data?.length || 0,
          source: 'supabase'
        });
      }

      const { data, error } = await supabase
        .from(SUPABASE_PRODUCTS_TABLE)
        .select('ten_sp, ma_sp, ma_sp_moi')
        .not('ten_sp', 'is', null)
        .order('ten_sp', { ascending: true });

      if (error) {
        console.error('Supabase san_pham query error:', error);
        return res.status(500).json({
          error: `Không thể tải danh sách sản phẩm từ ${SUPABASE_PRODUCTS_TABLE}. ${error.message}`
        });
      }

      const unique = new Map<string, { productName: string; productCode: string; newCode: string }>();
      (data || []).forEach((row) => {
        const productName = String(row.ten_sp ?? '').trim();
        const productCode = String(row.ma_sp ?? '').trim();
        const newCode = String(row.ma_sp_moi ?? '').trim();
        if (!productName) return;
        const key = `${productCode}|${productName}`;
        if (!unique.has(key)) {
          unique.set(key, { productName, productCode, newCode });
        }
      });

      const products = [...unique.values()];

      return res.json(products);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải danh sách sản phẩm.' });
    }
  });

  app.delete('/api/san-pham', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id: unknown) => String(id ?? '').trim()).filter(Boolean)
        : [];

      if (ids.length === 0) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất một sản phẩm để xóa.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_PRODUCTS_TABLE)
        .delete()
        .in('id', ids)
        .select('id');

      if (error) {
        console.error('Supabase san_pham bulk delete error:', error);
        return res.status(500).json({
          error: `Không thể xóa sản phẩm. ${error.message}`
        });
      }

      return res.json({
        success: true,
        deleted: data?.length || 0,
        ids: (data || []).map(row => row.id)
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa sản phẩm.' });
    }
  });

  app.patch('/api/san-pham/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID sản phẩm.' });
      }

      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const nplInput = body.npl_phan_tram ?? body.nplPhanTram ?? body.nplItems;
      const hasNplInput = nplInput !== undefined && nplInput !== null;
      const updateRecord: Record<string, unknown> = {};

      if (hasNplInput) {
        const parsedNpl = parseProductNplPhanTramInput(nplInput);
        if ('error' in parsedNpl) {
          return res.status(400).json({ error: parsedNpl.error });
        }
        updateRecord.npl_phan_tram = parsedNpl.items;
      }

      const productFieldKeys = [
        'code', 'ma_sp', 'newCode', 'ma_sp_moi', 'name', 'ten_sp', 'nature', 'tinh_chat', 'group', 'nhom_vthh',
        'unit', 'don_vi', 'openingStock', 'ton_dau_ky', 'inbound', 'nhap_trong_ky', 'outbound', 'xuat_trong_ky',
        'stock', 'sl_ton', 'minStock', 'so_luong_ton_toi_thieu',
        'origin', 'nguon_goc', 'description', 'mo_ta'
      ];
      const hasProductFields = productFieldKeys.some(key => Object.prototype.hasOwnProperty.call(body, key));

      if (hasProductFields) {
        const parsedProduct = parseProductPatchBody(body);
        if ('error' in parsedProduct) {
          return res.status(400).json({ error: parsedProduct.error });
        }
        Object.assign(updateRecord, parsedProduct.record);
      }

      if (Object.keys(updateRecord).length === 0) {
        return res.status(400).json({ error: 'Không có dữ liệu để cập nhật.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_PRODUCTS_TABLE)
        .update(updateRecord)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase san_pham update error:', error);
        return res.status(500).json({ error: productWriteErrorMessage(error) });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần cập nhật.' });
      }

      return res.json({ success: true, product: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật sản phẩm.' });
    }
  });

  app.get('/api/danh-sach-may', async (_req, res) => {
    if (!supabase) {
      return res.json({ machines: [], total: 0, source: 'local' });
    }

    try {
      const { data, error } = await supabase
        .from(SUPABASE_MACHINES_TABLE)
        .select('*');

      if (error) {
        console.error('Supabase danh_sach_may query error:', error);
        return res.status(500).json({
          error: `Không thể tải danh sách máy từ ${SUPABASE_MACHINES_TABLE}. ${error.message}`
        });
      }

      return res.json({
        machines: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải danh sách máy.' });
    }
  });

  app.post('/api/danh-sach-may', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

      if (!code || !name) {
        return res.status(400).json({ error: 'Vui lòng nhập mã máy và tên máy.' });
      }

      const record = {
        ma_may: code,
        ten_may: name,
        loai_may: typeof req.body?.type === 'string' ? req.body.type.trim() || 'Chưa phân loại' : 'Chưa phân loại',
        chi_nhanh: typeof req.body?.branch === 'string' ? req.body.branch.trim() : '',
        vi_tri: typeof req.body?.location === 'string' ? req.body.location.trim() : '',
        trang_thai: typeof req.body?.status === 'string' ? req.body.status.trim() || 'Đang dùng' : 'Đang dùng',
        ghi_chu: typeof req.body?.note === 'string' ? req.body.note.trim() : ''
      };

      const { data, error } = await supabase
        .from(SUPABASE_MACHINES_TABLE)
        .insert(record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase danh_sach_may insert error:', error);
        const missingTable = error.code === 'PGRST205';
        const missingColumn = error.code === 'PGRST204';
        return res.status(500).json({
          error: missingTable
            ? `Bảng ${SUPABASE_MACHINES_TABLE} chưa tồn tại. Hãy chạy file supabase-danh-sach-may.sql trong Supabase SQL Editor.`
            : missingColumn
              ? `Bảng ${SUPABASE_MACHINES_TABLE} đang thiếu cột. Hãy chạy file supabase-danh-sach-may.sql.`
              : `Không thể thêm máy vào ${SUPABASE_MACHINES_TABLE}. ${error.message}`
        });
      }

      return res.status(201).json({ success: true, machine: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi thêm máy mới.' });
    }
  });

  app.patch('/api/danh-sach-may/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID máy.' });
      }

      const parsed = parseMachineBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await updateMachineByKey(id, parsed.record);

      if (error) {
        console.error('Supabase danh_sach_may update error:', error);
        return res.status(500).json({ error: machineWriteErrorMessage(error) });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy máy cần cập nhật.' });
      }

      return res.json({ success: true, machine: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật máy.' });
    }
  });

  app.delete('/api/danh-sach-may/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID máy.' });
      }

      const { data, error } = await deleteMachineByKey(id);

      if (error) {
        console.error('Supabase danh_sach_may delete error:', error);
        return res.status(500).json({ error: `Không thể xóa máy. ${error.message}` });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy máy cần xóa.' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa máy.' });
    }
  });

  app.patch('/api/danh-sach-may/:id/image', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
      const imagePublicId = typeof req.body?.imagePublicId === 'string' ? req.body.imagePublicId.trim() : '';

      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID máy.' });
      }

      if (!imageUrl) {
        return res.status(400).json({ error: 'Thiếu URL ảnh máy.' });
      }

      const { data, error } = await updateMachineByKey(id, {
        anh_url: imageUrl,
        anh_public_id: imagePublicId || null
      });

      if (error) {
        console.error('Supabase danh_sach_may image update error:', error);
        return res.status(500).json({
          error: isMissingColumnError(error)
            ? `Bảng ${SUPABASE_MACHINES_TABLE} đang thiếu cột ảnh. Hãy chạy lại file supabase-danh-sach-may.sql.`
            : `Không thể cập nhật ảnh máy. ${error.message}`
        });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy máy cần cập nhật ảnh.' });
      }

      return res.json({ success: true, machine: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật ảnh máy.' });
    }
  });

  app.get('/api/don-hang', async (_req, res) => {
    if (!supabase) {
      return res.json({ orders: [], total: 0, source: 'local' });
    }

    try {
      const { data, error } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .select('*')
        .order('ma_don_hang', { ascending: true });

      if (error) {
        console.error('Supabase don_hang query error:', error);
        return res.status(500).json({
          error: `Không thể tải đơn hàng từ ${SUPABASE_ORDERS_TABLE}. ${error.message}`
        });
      }

      return res.json({
        orders: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải đơn hàng.' });
    }
  });

  app.post('/api/don-hang', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseOrderBody(req.body, { isCreate: true });
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase don_hang insert error:', error);
        return res.status(500).json({ error: orderWriteErrorMessage(error) });
      }

      return res.status(201).json({ success: true, order: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi thêm đơn hàng mới.' });
    }
  });

  app.patch('/api/don-hang/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID đơn hàng.' });
      }

      const parsed = parseOrderBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .update(parsed.record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase don_hang update error:', error);
        return res.status(500).json({ error: orderWriteErrorMessage(error) });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng cần cập nhật.' });
      }

      return res.json({ success: true, order: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật đơn hàng.' });
    }
  });

  app.delete('/api/don-hang/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID đơn hàng.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Supabase don_hang delete error:', error);
        return res.status(500).json({ error: `Không thể xóa đơn hàng. ${error.message}` });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng cần xóa.' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa đơn hàng.' });
    }
  });

  app.get('/api/lenh-sx', async (_req, res) => {
    if (!supabase) {
      return res.json({ productionOrders: [], total: 0, source: 'local' });
    }

    try {
      let { data, error } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .select('*')
        .order('ma_lenh_sx', { ascending: true });

      if (error && isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
          .select('*')
          .order('id', { ascending: true }));
      }

      if (error) {
        console.error('Supabase lenh_sx query error:', error);
        return res.status(500).json({
          error: `Không thể tải lệnh sản xuất từ ${SUPABASE_PRODUCTION_ORDERS_TABLE}. ${error.message}`
        });
      }

      return res.json({
        productionOrders: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải lệnh sản xuất.' });
    }
  });

  app.post('/api/lenh-sx/from-don-hang/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID đơn hàng.' });
      }

      const { data: order, error: orderError } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (orderError) {
        console.error('Supabase don_hang lookup error:', orderError);
        return res.status(500).json({ error: orderWriteErrorMessage(orderError) });
      }

      if (!order) {
        return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      }

      const orderRow = order as Record<string, unknown>;
      const existingLenh = pickRowField(orderRow, ['lenh_sx', 'production_order']);
      if (existingLenh && existingLenh !== '-') {
        return res.status(409).json({
          error: `Đơn hàng đã có lệnh SX: ${existingLenh}`,
          productionOrderCode: existingLenh
        });
      }

      const orderCode = pickRowField(orderRow, ['ma_don_hang', 'order_code', 'code']);
      const productCode = pickRowField(orderRow, ['ma_hang', 'ma_sp']);
      const productName = pickRowField(orderRow, ['ten_hang', 'ten_sp']);
      if (!orderCode) {
        return res.status(400).json({ error: 'Đơn hàng thiếu mã đơn — không thể tạo lệnh SX.' });
      }
      if (!productCode && !productName) {
        return res.status(400).json({ error: 'Đơn hàng thiếu mã hàng hoặc tên hàng — không thể tạo lệnh SX.' });
      }

      let code = makeProductionOrderCode(orderCode);
      code = await ensureUniqueProductionOrderCode(code);

      const record = buildProductionOrderRecordFromOrder(orderRow, code);
      const { data: created, error: insertError } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .insert(record)
        .select('*')
        .single();

      if (insertError) {
        console.error('Supabase lenh_sx insert error:', insertError);
        return res.status(500).json({ error: productionOrderWriteErrorMessage(insertError) });
      }

      const { error: updateError } = await supabase
        .from(SUPABASE_ORDERS_TABLE)
        .update({ lenh_sx: code })
        .eq('id', id);

      if (updateError) {
        console.error('Supabase don_hang lenh_sx update error:', updateError);
        return res.status(201).json({
          success: true,
          productionOrder: created,
          code,
          warning: `Đã tạo lệnh SX ${code} nhưng chưa cập nhật được cột lenh_sx trên đơn hàng.`
        });
      }

      return res.status(201).json({
        success: true,
        productionOrder: created,
        code
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tạo lệnh sản xuất.' });
    }
  });

  app.post('/api/lenh-sx', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseProductionOrderBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const record = { ...parsed.record };
      record.ma_lenh_sx = await ensureUniqueProductionOrderCode(String(record.ma_lenh_sx));

      const { data: created, error: insertError } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .insert(record)
        .select('*')
        .single();

      if (insertError) {
        console.error('Supabase lenh_sx insert error:', insertError);
        return res.status(500).json({ error: productionOrderWriteErrorMessage(insertError) });
      }

      return res.status(201).json({
        success: true,
        productionOrder: created,
        code: record.ma_lenh_sx
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tạo lệnh sản xuất.' });
    }
  });

  app.get('/api/khach-hang', async (_req, res) => {
    if (!supabase) {
      return res.json({ customers: [], total: 0, source: 'local' });
    }

    try {
      const { data, error } = await supabase
        .from(SUPABASE_CUSTOMERS_TABLE)
        .select('*')
        .order('ten_khach_hang', { ascending: true });

      if (error && isMissingColumnError(error)) {
        const fallback = await supabase
          .from(SUPABASE_CUSTOMERS_TABLE)
          .select('*');
        if (fallback.error) {
          console.error('Supabase khach_hang query error:', fallback.error);
          return res.status(500).json({
            error: `Không thể tải khách hàng từ ${SUPABASE_CUSTOMERS_TABLE}. ${fallback.error.message}`
          });
        }
        return res.json({
          customers: fallback.data || [],
          total: fallback.data?.length || 0,
          source: 'supabase'
        });
      }

      if (error) {
        console.error('Supabase khach_hang query error:', error);
        return res.status(500).json({
          error: `Không thể tải khách hàng từ ${SUPABASE_CUSTOMERS_TABLE}. ${error.message}`
        });
      }

      return res.json({
        customers: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải khách hàng.' });
    }
  });

  app.get('/api/cai-dat', async (_req, res) => {
    if (!supabase) {
      return res.json({ settings: [], total: 0, source: 'local' });
    }

    try {
      let { data, error } = await supabase
        .from(SUPABASE_SETTINGS_TABLE)
        .select('*')
        .order('ma_cai_dat', { ascending: true });

      if (error && isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from(SUPABASE_SETTINGS_TABLE)
          .select('*')
          .order('id', { ascending: true }));
      }

      if (error) {
        console.error('Supabase cai_dat query error:', error);
        return res.status(500).json({
          error: `Không thể tải cài đặt từ ${SUPABASE_SETTINGS_TABLE}. ${error.message}`
        });
      }

      return res.json({
        settings: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải cài đặt.' });
    }
  });

  app.post('/api/cai-dat', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseSettingBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await writeSettingRecord(supabase, parsed);

      if (error) {
        console.error('Supabase cai_dat insert error:', error);
        return res.status(500).json({ error: settingsWriteErrorMessage(error) });
      }

      return res.status(201).json({ success: true, setting: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi thêm cài đặt mới.' });
    }
  });

  app.patch('/api/cai-dat/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID cài đặt.' });
      }

      const parsed = parseSettingBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await writeSettingRecord(supabase, parsed, id);

      if (error) {
        console.error('Supabase cai_dat update error:', error);
        return res.status(500).json({ error: settingsWriteErrorMessage(error) });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy cài đặt cần cập nhật.' });
      }

      return res.json({ success: true, setting: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật cài đặt.' });
    }
  });

  app.delete('/api/cai-dat/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID cài đặt.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_SETTINGS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Supabase cai_dat delete error:', error);
        return res.status(500).json({
          error: `Không thể xóa cài đặt. ${error.message}`
        });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy cài đặt cần xóa.' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa cài đặt.' });
    }
  });

  app.get('/api/kho-nvl', async (_req, res) => {
    if (!supabase) {
      return res.json({ materials: [], total: 0, source: 'local' });
    }

    try {
      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .select('*')
        .order('ma_npl', { ascending: true });

      if (error) {
        console.error('Supabase kho_nvl query error:', error);
        return res.status(500).json({
          error: `Không thể tải nguyên phụ liệu từ ${SUPABASE_MATERIALS_TABLE}. ${error.message}`
        });
      }

      const movementTotals = await buildMaterialMovementTotals();
      const materials = applyMaterialMovementTotals(data || [], movementTotals);

      return res.json({
        materials,
        total: materials.length,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải nguyên phụ liệu.' });
    }
  });

  app.post('/api/kho-nvl', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseMaterialBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase kho_nvl insert error:', error);
        return res.status(500).json({ error: materialWriteErrorMessage(error) });
      }

      return res.status(201).json({ success: true, material: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi thêm nguyên phụ liệu.' });
    }
  });

  app.patch('/api/kho-nvl/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID nguyên phụ liệu.' });
      }

      const parsed = parseMaterialBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .update(parsed.record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase kho_nvl update error:', error);
        return res.status(500).json({ error: materialWriteErrorMessage(error) });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy nguyên phụ liệu cần cập nhật.' });
      }

      return res.json({ success: true, material: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật nguyên phụ liệu.' });
    }
  });

  app.delete('/api/kho-nvl/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID nguyên phụ liệu.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Supabase kho_nvl delete error:', error);
        return res.status(500).json({ error: `Không thể xóa nguyên phụ liệu. ${error.message}` });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy nguyên phụ liệu cần xóa.' });
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa nguyên phụ liệu.' });
    }
  });

  app.get('/api/phieu-xuat-nhap-kho', async (req, res) => {
    if (!supabase) {
      return res.json({ movements: [], total: 0, source: 'local' });
    }

    try {
      const loaiFilter = parseWarehouseSlipType(req.query.loai ?? req.query.type);
      const khoFilter = parseWarehouseStorageType(req.query.loai_kho ?? req.query.kho ?? req.query.warehouseKind);
      const fromDate = parseWarehouseSlipDate(req.query.from ?? req.query.tu_ngay);
      const toDate = parseWarehouseSlipDate(req.query.to ?? req.query.den_ngay);
      const slipCode = String(req.query.ma_phieu ?? req.query.slipCode ?? '').trim();
      const maNpl = String(req.query.ma_npl ?? req.query.materialCode ?? '').trim();
      const maSp = String(req.query.ma_sp ?? req.query.productCode ?? '').trim();

      let query = supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .select('*')
        .order('ngay_phieu', { ascending: false })
        .order('created_at', { ascending: false });

      if (loaiFilter) query = query.eq('loai_phieu', loaiFilter);
      if (khoFilter === 'san_pham') {
        query = query.eq('loai_kho', 'san_pham');
      } else if (khoFilter === 'nvl') {
        query = query.or('loai_kho.eq.nvl,loai_kho.is.null');
      }
      if (fromDate) query = query.gte('ngay_phieu', fromDate);
      if (toDate) query = query.lte('ngay_phieu', toDate);
      if (slipCode) query = query.eq('ma_phieu', slipCode);
      if (maNpl) query = query.eq('ma_npl', maNpl);
      if (maSp) query = query.eq('ma_sp', maSp);

      const { data, error } = await query;

      if (error) {
        console.error('Supabase phieu_xuat_nhap_kho query error:', error);
        return res.status(500).json({
          error: `Không thể tải lịch sử xuất nhập kho từ ${SUPABASE_WAREHOUSE_MOVEMENTS_TABLE}. ${error.message}`
        });
      }

      return res.json({
        movements: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải lịch sử xuất nhập kho.' });
    }
  });

  app.post('/api/phieu-xuat-nhap-kho', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseWarehouseSlipBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const maPhieu = generateWarehouseSlipCode(parsed.loaiPhieu);
      const nhanSu = parsed.nguoiLap || 'Hệ thống';
      const records = parsed.items.map(item => {
        const base = {
          ma_phieu: maPhieu,
          loai_phieu: parsed.loaiPhieu,
          loai_kho: parsed.loaiKho,
          ngay_phieu: parsed.ngayPhieu,
          don_vi: item.unit || '',
          so_luong: item.quantity,
          don_gia: item.unitPrice,
          thanh_tien: item.lineAmount,
          ly_do: parsed.lyDo || '',
          ghi_chu: parsed.ghiChu || '',
          nguoi_lap: parsed.nguoiLap || nhanSu,
          nhan_su: nhanSu
        };

        if (parsed.loaiKho === 'san_pham') {
          return {
            ...base,
            ma_sp: item.code,
            ten_sp: item.name || '',
            ma_npl: '',
            ten_npl: ''
          };
        }

        return {
          ...base,
          ma_npl: item.code,
          ten_npl: item.name || '',
          ma_sp: '',
          ten_sp: ''
        };
      });

      const { data, error } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .insert(records)
        .select('*');

      if (error) {
        console.error('Supabase phieu_xuat_nhap_kho insert error:', error);
        return res.status(500).json({ error: warehouseSlipWriteErrorMessage(error) });
      }

      if (parsed.loaiKho === 'nvl') {
        const nvlCodes = [...new Set(parsed.items.map(item => item.code.trim()).filter(Boolean))];
        await Promise.all(nvlCodes.map(code => syncMaterialInventoryFromMovements(code)));
      }

      return res.status(201).json({
        success: true,
        slipCode: maPhieu,
        movements: data || []
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tạo phiếu xuất nhập kho.' });
    }
  });

  app.delete('/api/phieu-xuat-nhap-kho/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID dòng phiếu.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .delete()
        .eq('id', id)
        .select('id, ma_npl, loai_kho')
        .maybeSingle();

      if (error) {
        console.error('Supabase phieu_xuat_nhap_kho delete error:', error);
        return res.status(500).json({ error: `Không thể xóa dòng phiếu. ${error.message}` });
      }

      if (!data) {
        return res.status(404).json({ error: 'Không tìm thấy dòng phiếu cần xóa.' });
      }

      if (data.ma_npl && String(data.loai_kho || 'nvl') !== 'san_pham') {
        await syncMaterialInventoryFromMovements(String(data.ma_npl));
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa dòng phiếu.' });
    }
  });

  app.get('/api/nhan-su', async (req, res) => {
    if (!supabase) {
      return res.json([]);
    }

    try {
      const format = typeof req.query.format === 'string' ? req.query.format : 'list';
      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'filtered';
      const departmentFilter = `%${SUPABASE_STAFF_DEPARTMENT}%`;
      const branchFilter = `%${SUPABASE_STAFF_BRANCH}%`;

      if (format === 'groups') {
        const { data, error } = await supabase
          .from(SUPABASE_STAFF_TABLE)
          .select('*');

        if (error) {
          console.error('Supabase nhan_su group query error:', error);
          return res.status(500).json({
            error: `Không thể tải danh sách nhân sự từ ${SUPABASE_STAFF_TABLE}. ${error.message}`
          });
        }

        const rows = ((data || []) as Record<string, unknown>[])
          .filter(row => pickStaffName(row));

        const filteredRows = scope === 'all'
          ? rows
          : rows.filter(row => {
              const department = pickStaffField(row, ['phong_ban', 'phongban', 'department']).toLowerCase();
              const branch = pickStaffField(row, ['chi_nhanh', 'chi_nhanh_lam_viec', 'branch', 'co_so']).toLowerCase();
              return (
                department.includes(SUPABASE_STAFF_DEPARTMENT.toLowerCase()) &&
                branch.includes(SUPABASE_STAFF_BRANCH.toLowerCase())
              );
            });

        return res.json({
          branches: buildStaffGroups(filteredRows),
          total: filteredRows.length,
          source: 'supabase'
        });
      }

      const staffSelect = 'nhan_su, phong_ban, chi_nhanh';

      async function runStaffQuery(mode: 'dept-branch' | 'dept-only' | 'all') {
        let query = supabase!
          .from(SUPABASE_STAFF_TABLE)
          .select(staffSelect)
          .not('nhan_su', 'is', null)
          .order('nhan_su', { ascending: true });

        if (mode === 'dept-branch') {
          query = query.ilike('phong_ban', departmentFilter).ilike('chi_nhanh', branchFilter);
        } else if (mode === 'dept-only') {
          query = query.ilike('phong_ban', departmentFilter);
        }

        let { data, error } = await query;

        if (error && isMissingColumnError(error)) {
          let fallback = supabase!.from(SUPABASE_STAFF_TABLE).select('*');
          if (mode === 'dept-branch') {
            fallback = fallback.ilike('phong_ban', departmentFilter).ilike('chi_nhanh', branchFilter);
          } else if (mode === 'dept-only') {
            fallback = fallback.ilike('phong_ban', departmentFilter);
          }
          ({ data, error } = await fallback);
        }

        return { data, error };
      }

      const queryModes: Array<'dept-branch' | 'dept-only' | 'all'> = ['dept-branch', 'dept-only', 'all'];
      let data: Record<string, unknown>[] | null = null;
      let lastError: { message?: string } | null = null;

      for (const mode of queryModes) {
        const result = await runStaffQuery(mode);
        if (result.error) {
          lastError = result.error;
          continue;
        }

        const names = [...new Set((result.data || []).map(pickStaffName).filter(Boolean))];
        if (names.length > 0) {
          data = result.data;
          if (mode !== 'dept-branch') {
            console.warn(`[nhan-su] Fallback mode "${mode}" returned ${names.length} staff.`);
          }
          break;
        }
      }

      if (!data) {
        if (lastError) {
          console.error('Supabase nhan_su query error:', lastError);
          return res.status(500).json({
            error: `Không thể tải danh sách nhân sự từ ${SUPABASE_STAFF_TABLE}. ${lastError.message}`
          });
        }
        return res.json([]);
      }

      const names = [...new Set(data.map(pickStaffName).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'vi')
      );

      return res.json(names.map(name => ({ name })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải danh sách nhân sự.' });
    }
  });

  app.get('/api/phieu-can-dinh-ki', async (req, res) => {
    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
      const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';

      if (supabase) {
        let query = supabase
          .from(SUPABASE_WEIGHING_TABLE)
          .select('*')
          .order('ngay_san_xuat', { ascending: false })
          .order('ca_san_xuat', { ascending: true })
          .order('gio_can', { ascending: true });

        if (ngay) {
          query = query.or(`ngay_san_xuat.eq.${ngay},report_date.eq.${ngay}`);
        } else {
          if (from) query = query.gte('ngay_san_xuat', from);
          if (to) query = query.lte('ngay_san_xuat', to);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Supabase weighing query error:', error);
          return res.status(500).json({
            error: `Không thể tải phiếu cân từ ${SUPABASE_WEIGHING_TABLE}. ${error.message}`
          });
        }

        return res.json((data || []).map((row) => mapWeighingRow(row as Record<string, unknown>)));
      }

      let records = getWeighingReportsFromLocal();
      if (ngay) {
        records = records.filter(
          record => record.productionDate === ngay || record.reportDate === ngay
        );
      } else {
        if (from) records = records.filter(record => record.productionDate >= from);
        if (to) records = records.filter(record => record.productionDate <= to);
      }

      return res.json(records);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải phiếu cân.' });
    }
  });

  app.post('/api/phieu-can-dinh-ki', async (req, res) => {
    try {
      const payload = req.body;
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập ít nhất một dòng cân.' });
      }

      const records = rows
        .filter((row: any) =>
          row.productCode || row.productName || row.machineName || row.coreWeight || row.weighNo || row.weight || row.imageUrl || row.coreWeightImageUrl
        )
        .map((row: any) => buildDbRecordFromClientRow(row, payload));

      if (records.length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập ít nhất một dòng cân có dữ liệu.' });
      }

      const missingShift = records.find(record => !record.ngay_san_xuat || !record.ca_san_xuat);
      if (missingShift) {
        return res.status(400).json({ error: 'Mỗi dòng cần có ngày sản xuất và ca sản xuất.' });
      }

      if (supabase) {
        const insertResult = await insertWeighingRecords(records);

        if (!insertResult.ok) {
          const error = insertResult.error;
          console.error('Supabase weighing insert error:', error);

          if (isSupabaseNetworkError(error)) {
            const savedLocally = await saveWeighingPayloadLocally(payload, rows);
            if (savedLocally.ok) {
              return res.status(201).json({
                success: true,
                inserted: records.length,
                mode: 'local',
                rows: savedLocally.rows,
                warning:
                  'Mất kết nối Supabase tạm thời. Đã lưu tạm vào file local — dữ liệu sẽ cần đồng bộ lại khi mạng ổn định.'
              });
            }
          }

          const missingColumn = error?.code === 'PGRST204';
          const rlsBlocked = error?.code === '42501';
          return res.status(500).json({
            error: missingColumn
              ? `Bảng ${SUPABASE_WEIGHING_TABLE} đang thiếu cột. Hãy chạy file supabase-phieu-can-dinh-ki.sql trong Supabase SQL Editor.`
              : rlsBlocked
                ? `Supabase đang chặn ghi do RLS trên bảng ${SUPABASE_WEIGHING_TABLE}. Hãy dùng SUPABASE_SERVICE_KEY ở backend hoặc thêm policy INSERT cho role anon/authenticated.`
                : isSupabaseNetworkError(error)
                  ? `Không kết nối được Supabase (lỗi mạng). Kiểm tra internet, firewall và thử lại. Chi tiết: ${error?.message || 'fetch failed'}`
                  : `Không thể ghi phiếu cân vào bảng ${SUPABASE_WEIGHING_TABLE}. ${error?.message || ''}`.trim()
          });
        }

        return res.status(201).json({
          success: true,
          inserted: records.length,
          mode: 'supabase',
          rows: (insertResult.data || []).map((row) => mapWeighingRow(row as Record<string, unknown>))
        });
      }

      const savedLocally = await saveWeighingPayloadLocally(payload, rows);
      if (savedLocally.ok) {
        return res.status(201).json({
          success: true,
          inserted: records.length,
          mode: 'local',
          rows: savedLocally.rows
        });
      }

      return res.status(500).json({ error: 'Không thể lưu phiếu cân local.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi hệ thống khi lưu phiếu cân.' });
    }
  });

  app.patch('/api/phieu-can-dinh-ki/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID dòng cân.' });
      }

      const row = req.body?.row;
      if (!row || typeof row !== 'object') {
        return res.status(400).json({ error: 'Thiếu dữ liệu dòng cân.' });
      }

      const payload = req.body;
      const record = buildDbRecordFromClientRow(row, payload);

      if (!record.ngay_san_xuat || !record.ca_san_xuat) {
        return res.status(400).json({ error: 'Mỗi dòng cần có ngày sản xuất và ca sản xuất.' });
      }

      if (isLocalWeighingId(id)) {
        const updated = updateWeighingRecordLocal(id, record);
        if (!updated) {
          return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
        }

        return res.json({ success: true, row: updated, mode: 'local' });
      }

      if (supabase) {
        const dbId = parseWeighingId(id);
        const { data, error } = await supabase
          .from(SUPABASE_WEIGHING_TABLE)
          .update(record)
          .eq('id', dbId)
          .select('*')
          .maybeSingle();

        if (error) {
          console.error('Supabase weighing update error:', error);
          const rlsBlocked = error.code === '42501';
          return res.status(500).json({
            error: rlsBlocked
              ? `Supabase chặn cập nhật do RLS. Chạy supabase-phieu-can-dinh-ki.sql hoặc dùng SUPABASE_SERVICE_KEY.`
              : `Không thể cập nhật dòng cân. ${error.message}`
          });
        }

        if (data) {
          return res.json({
            success: true,
            row: mapWeighingRow(data as Record<string, unknown>),
            mode: 'supabase'
          });
        }

        const updatedLocally = updateWeighingRecordLocal(id, record);
        if (updatedLocally) {
          return res.json({ success: true, row: updatedLocally, mode: 'local' });
        }

        return res.status(404).json({ error: 'Không tìm thấy dòng cân.' });
      }

      const updated = updateWeighingRecordLocal(id, record);
      if (!updated) {
        return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
      }

      return res.json({ success: true, row: updated, mode: 'local' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật dòng cân.' });
    }
  });

  app.delete('/api/phieu-can-dinh-ki/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID dòng cân.' });
      }

      if (isLocalWeighingId(id)) {
        const deleted = deleteWeighingRecordLocal(id);
        if (!deleted) {
          return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
        }

        return res.json({ success: true, mode: 'local' });
      }

      if (supabase) {
        const dbId = parseWeighingId(id);
        const { data, error } = await supabase
          .from(SUPABASE_WEIGHING_TABLE)
          .delete()
          .eq('id', dbId)
          .select('id')
          .maybeSingle();

        if (error) {
          console.error('Supabase weighing delete error:', error);
          const rlsBlocked = error.code === '42501';
          return res.status(500).json({
            error: rlsBlocked
              ? `Supabase chặn xóa do RLS. Chạy supabase-phieu-can-dinh-ki.sql hoặc dùng SUPABASE_SERVICE_KEY.`
              : `Không thể xóa dòng cân. ${error.message}`
          });
        }

        if (data) {
          return res.json({ success: true, mode: 'supabase' });
        }

        const deletedLocally = deleteWeighingRecordLocal(id);
        if (deletedLocally) {
          return res.json({ success: true, mode: 'local' });
        }

        return res.status(404).json({ error: 'Không tìm thấy dòng cân.' });
      }

      const deleted = deleteWeighingRecordLocal(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
      }

      return res.json({ success: true, mode: 'local' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa dòng cân.' });
    }
  });

  app.post('/api/cloudinary/upload', async (req, res) => {
    try {
      const { imageDataUrl } = req.body;
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        return res.status(400).json({ error: 'Thiếu dữ liệu ảnh.' });
      }

      const result = await uploadImageToCloudinary(imageDataUrl);
      return res.status(201).json(result);
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      res.status(500).json({ error: err.message || 'Không thể upload ảnh.' });
    }
  });

  // API Route: Reset database (optional/utility)
  app.post('/api/reports/reset', (req, res) => {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        fs.unlinkSync(DB_FILE_PATH);
      }
      const seeded = getReportsFromDb();
      res.json({ message: 'Đã hoàn tác và tạo mới dữ liệu mẫu biên chế!', data: seeded });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Development / Production Environment routing integrations
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API route không tồn tại. Hãy chạy npm run dev để khởi động lại server.'
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      cacheDir: '.vite',
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[FULLSTACK] Server running on http://0.0.0.0:${PORT}`);
    // Initialize DB with seed reports if missing
    getReportsFromDb();
  });
}

startServer();
