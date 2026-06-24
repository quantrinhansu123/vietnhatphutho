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
        console.error('Lỗi khi truy vấn Supabase:', error);
      } else if (data) {
        return data;
      }
    } catch (error) {
      console.error('Lỗi khi truy vấn Supabase:', error);
    }
  }

  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const seedReports = getSeedReports();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seedReports, null, 2), 'utf-8');
      return seedReports;
    }

    const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Lỗi khi đọc file CSDL:', error);
    return [];
  }
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

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3001;

  app.use(express.json({ limit: '12mb' }));

  // API Route: Get all reports
  app.get('/api/reports', async (req, res) => {
    const list = await getReportsFromDb();
    // Sort by Date descending (most recent first)
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(list);
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

        if (error || !data) {
          console.error('Supabase insert error:', error);
          return res.status(500).json({ error: 'Không thể ghi lưu báo cáo mới vào Supabase!' });
        }

        return res.status(201).json(data);
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

      return res.json({
        materials: data || [],
        total: data?.length || 0,
        source: 'supabase'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải nguyên phụ liệu.' });
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
