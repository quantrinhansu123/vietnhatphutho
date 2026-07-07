import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductionReport } from './src/types';

dotenv.config();

const DB_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'reports-db.json')
  : path.join(process.cwd(), 'reports-db.json');
const WEIGHING_DB_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'phieu-can-dinh-ki-db.json')
  : path.join(process.cwd(), 'phieu-can-dinh-ki-db.json');
const DAMAGED_GOODS_DB_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'bao-cao-hang-hong-db.json')
  : path.join(process.cwd(), 'bao-cao-hang-hong-db.json');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'reports';
const SUPABASE_WEIGHING_TABLE = process.env.SUPABASE_WEIGHING_TABLE || 'phieu_can_dinh_ki';
const SUPABASE_DAMAGED_GOODS_TABLE = process.env.SUPABASE_DAMAGED_GOODS_TABLE || 'bao_cao_hang_hong';
const SUPABASE_PRODUCTS_TABLE = process.env.SUPABASE_PRODUCTS_TABLE || 'san_pham';
const SUPABASE_MACHINES_TABLE = process.env.SUPABASE_MACHINES_TABLE || 'danh_sach_may';
const SUPABASE_MATERIALS_TABLE = process.env.SUPABASE_MATERIALS_TABLE || 'kho_nvl';
const SUPABASE_STAFF_TABLE = process.env.SUPABASE_STAFF_TABLE || 'nhan_su';
const SUPABASE_ORDERS_TABLE = process.env.SUPABASE_ORDERS_TABLE || 'don_hang';
const SUPABASE_CUSTOMERS_TABLE = process.env.SUPABASE_CUSTOMERS_TABLE || 'khach_hang';
const SUPABASE_SETTINGS_TABLE = process.env.SUPABASE_SETTINGS_TABLE || 'cai_dat_thoi_gian';
const SUPABASE_PRODUCTION_ORDERS_TABLE = process.env.SUPABASE_PRODUCTION_ORDERS_TABLE || 'lenh_sx';
const SUPABASE_PRODUCTION_PLANS_TABLE = process.env.SUPABASE_PRODUCTION_PLANS_TABLE || 'ke_hoach_san_xuat';
const SUPABASE_PRODUCTION_PLAN_LINES_TABLE =
  process.env.SUPABASE_PRODUCTION_PLAN_LINES_TABLE || 'ke_hoach_san_xuat_dong';
const SUPABASE_WAREHOUSE_MOVEMENTS_TABLE = process.env.SUPABASE_WAREHOUSE_MOVEMENTS_TABLE || 'phieu_xuat_nhap_kho';
const SUPABASE_MIXING_REPORTS_TABLE = process.env.SUPABASE_MIXING_REPORTS_TABLE || 'bao_cao_phoi_tron';
const SUPABASE_ACCEPTANCE_REPORTS_TABLE = process.env.SUPABASE_ACCEPTANCE_REPORTS_TABLE || 'bao_cao_nghiem_thu';
const SUPABASE_MACHINE_NVL_REPORTS_TABLE =
  process.env.SUPABASE_MACHINE_NVL_REPORTS_TABLE || 'bao_cao_may_nvl_ton';
const SUPABASE_MACHINE_DOWNTIME_TABLE =
  process.env.SUPABASE_MACHINE_DOWNTIME_TABLE || 'phieu_bao_dung_may';
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
    damagedGoods: SUPABASE_DAMAGED_GOODS_TABLE,
    products: SUPABASE_PRODUCTS_TABLE,
    machines: SUPABASE_MACHINES_TABLE,
    materials: SUPABASE_MATERIALS_TABLE,
    staff: SUPABASE_STAFF_TABLE,
    orders: SUPABASE_ORDERS_TABLE,
    customers: SUPABASE_CUSTOMERS_TABLE,
    settings: SUPABASE_SETTINGS_TABLE,
    productionOrders: SUPABASE_PRODUCTION_ORDERS_TABLE,
    productionPlans: SUPABASE_PRODUCTION_PLANS_TABLE,
    productionPlanLines: SUPABASE_PRODUCTION_PLAN_LINES_TABLE,
    warehouseMovements: SUPABASE_WAREHOUSE_MOVEMENTS_TABLE,
    mixingReports: SUPABASE_MIXING_REPORTS_TABLE,
    acceptanceReports: SUPABASE_ACCEPTANCE_REPORTS_TABLE,
    machineNvlReports: SUPABASE_MACHINE_NVL_REPORTS_TABLE,
    machineDowntime: SUPABASE_MACHINE_DOWNTIME_TABLE,
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
        .from(SUPABASE_TABLE)
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          console.warn(`[SUPABASE] Bảng ${SUPABASE_TABLE} chưa tồn tại — dùng file local. Chạy supabase-reports.sql.`);
        } else {
          console.error('Lỗi khi truy vấn Supabase:', error);
        }
      } else if (data) {
        return data as ProductionReport[];
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
    trong_luong_bi: emptyToNull(row.shellWeight),
    ten_may_san_xuat: emptyToNull(row.machineName),
    lan_can: parseOptionalInt(weighNo),
    gio_can: weighTime || normalizeWeighTime(new Date().toTimeString().slice(0, 5)),
    trong_luong: emptyToNull(row.weight),
    anh_url: emptyToNull(row.imageUrl),
    anh_public_id: emptyToNull(row.imagePublicId),
    nghiem_thu: emptyToNull(row.acceptanceStatus),
    ghi_chu: emptyToNull(row.note)
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
    shellWeight: String(row.trong_luong_bi ?? '').trim(),
    weight: String(row.trong_luong ?? '').trim(),
    imageUrl: String(row.anh_url ?? '').trim() || undefined,
    coreWeightImageUrl: String(row.anh_trong_luong_loi_url ?? '').trim() || undefined,
    acceptanceStatus: String(row.nghiem_thu ?? '').trim(),
    note: String(row.ghi_chu ?? '').trim(),
    createdAt: String(row.created_at ?? '').trim() || undefined
  };
}

type WeighingSlipApiConfig = {
  localFilePath: string;
  supabaseTable: string;
  sqlMigrationFile: string;
  entityLabel: string;
  localEntryPrefix: string;
};

function createWeighingLocalStore(cfg: Pick<WeighingSlipApiConfig, 'localFilePath' | 'localEntryPrefix'>) {
  const { localFilePath, localEntryPrefix } = cfg;

  const readLocalEntries = () => {
    try {
      if (!fs.existsSync(localFilePath)) return [];
      const saved = JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.error('Lỗi khi đọc phiếu local:', error);
      return [];
    }
  };

  const writeLocalEntries = (entries: any[]) => {
    fs.writeFileSync(localFilePath, JSON.stringify(entries, null, 2), 'utf-8');
  };

  const getReportsFromLocal = (): ReturnType<typeof mapWeighingRow>[] => {
    try {
      if (!fs.existsSync(localFilePath)) return [];

      const saved = JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
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
      console.error('Lỗi khi đọc phiếu local:', error);
      return [];
    }
  };

  const saveReportToLocal = async (report: any): Promise<boolean> => {
    try {
      const current = fs.existsSync(localFilePath)
        ? JSON.parse(fs.readFileSync(localFilePath, 'utf-8'))
        : [];
      current.unshift(report);
      fs.writeFileSync(localFilePath, JSON.stringify(current, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu phiếu local:', error);
      return false;
    }
  };

  const findLocalRow = (id: string) => {
    const entries = readLocalEntries();

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
  };

  const updateRecordLocal = (id: string, record: Record<string, unknown>) => {
    const found = findLocalRow(id);
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
      trong_luong_bi: record.trong_luong_bi,
      ten_may_san_xuat: record.ten_may_san_xuat,
      lan_can: record.lan_can,
      gio_can: record.gio_can,
      trong_luong: record.trong_luong,
      anh_url: record.anh_url,
      anh_public_id: record.anh_public_id,
      nghiem_thu: record.nghiem_thu,
      ghi_chu: record.ghi_chu
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
      shellWeight: record.trong_luong_bi,
      machineName: record.ten_may_san_xuat,
      weighNo: record.lan_can,
      weighTime: record.gio_can,
      weight: record.trong_luong,
      imageUrl: record.anh_url,
      imagePublicId: record.anh_public_id,
      acceptanceStatus: record.nghiem_thu,
      note: record.ghi_chu
    };

    writeLocalEntries(found.entries);
    return mapWeighingRow({ ...found.rows[found.index], id });
  };

  const deleteRecordLocal = (id: string) => {
    const found = findLocalRow(id);
    if (!found) return false;

    found.rows.splice(found.index, 1);
    if (found.rows.length === 0) {
      const entryIndex = found.entries.indexOf(found.entry);
      if (entryIndex >= 0) {
        found.entries.splice(entryIndex, 1);
      }
    }

    writeLocalEntries(found.entries);
    return true;
  };

  const savePayloadLocally = async (payload: any, rows: any[]) => {
    const stamp = Date.now();
    const rowsWithIds = rows.map((row, index) => ({
      ...row,
      dbId: row.dbId || `local_${stamp}_${index}`,
      id: row.dbId || `local_${stamp}_${index}`
    }));

    const success = await saveReportToLocal({
      id: `${localEntryPrefix}${stamp}_${Math.random().toString(36).substring(2, 7)}`,
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
  };

  return {
    getReportsFromLocal,
    saveReportToLocal,
    findLocalRow,
    updateRecordLocal,
    deleteRecordLocal,
    savePayloadLocally
  };
}

async function insertWeighingRecordsToTable(
  supabaseTable: string,
  records: Record<string, unknown>[]
) {
  if (!supabase) {
    return { ok: false as const, error: { message: 'Supabase chưa được cấu hình.' } };
  }

  let lastError: { message?: string; code?: string } | null = null;

  for (let attempt = 1; attempt <= SUPABASE_FETCH_RETRIES; attempt++) {
    const { data, error } = await supabase.from(supabaseTable).insert(records).select('*');
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

function registerWeighingSlipRoutes(app: express.Application, apiPath: string, cfg: WeighingSlipApiConfig) {
  const store = createWeighingLocalStore(cfg);

  app.get(apiPath, async (req, res) => {
    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const from = typeof req.query.from === 'string' ? req.query.from.trim() : parseWarehouseSlipDate(req.query.tu_ngay);
      const to = typeof req.query.to === 'string' ? req.query.to.trim() : parseWarehouseSlipDate(req.query.den_ngay);

      if (supabase) {
        let query = supabase
          .from(cfg.supabaseTable)
          .select('*')
          .order('ngay_san_xuat', { ascending: false })
          .order('ca_san_xuat', { ascending: true })
          .order('gio_can', { ascending: true });

        if (ngay) {
          query = query.or(`ngay_san_xuat.eq.${ngay},report_date.eq.${ngay}`);
        } else if (from && to) {
          query = query.or(
            `and(ngay_san_xuat.gte.${from},ngay_san_xuat.lte.${to}),and(report_date.gte.${from},report_date.lte.${to})`
          );
        } else if (from) {
          query = query.or(`ngay_san_xuat.gte.${from},report_date.gte.${from}`);
        } else if (to) {
          query = query.or(`ngay_san_xuat.lte.${to},report_date.lte.${to}`);
        }

        const { data, error } = await query;
        if (error) {
          console.error(`Supabase ${cfg.entityLabel} query error:`, error);
          return res.status(500).json({
            error: `Không thể tải ${cfg.entityLabel} từ ${cfg.supabaseTable}. ${error.message}`
          });
        }

        return res.json((data || []).map((row) => mapWeighingRow(row as Record<string, unknown>)));
      }

      let records = store.getReportsFromLocal();
      if (ngay) {
        records = records.filter(
          record => record.productionDate === ngay || record.reportDate === ngay
        );
      } else {
        if (from) {
          records = records.filter(record => {
            const d = record.productionDate || record.reportDate;
            return d && d >= from;
          });
        }
        if (to) {
          records = records.filter(record => {
            const d = record.productionDate || record.reportDate;
            return d && d <= to;
          });
        }
      }

      return res.json(records);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || `Lỗi khi tải ${cfg.entityLabel}.` });
    }
  });

  app.post(apiPath, async (req, res) => {
    try {
      const payload = req.body;
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập ít nhất một dòng cân.' });
      }

      const records = rows
        .filter((row: any) =>
          row.productCode || row.productName || row.machineName || row.coreWeight || row.shellWeight || row.weighNo || row.weight || row.imageUrl || row.coreWeightImageUrl || row.acceptanceStatus || row.note
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
        const insertResult = await insertWeighingRecordsToTable(cfg.supabaseTable, records);

        if (!insertResult.ok) {
          const error = insertResult.error;
          console.error(`Supabase ${cfg.entityLabel} insert error:`, error);

          if (isSupabaseNetworkError(error)) {
            const savedLocally = await store.savePayloadLocally(payload, rows);
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
              ? `Bảng ${cfg.supabaseTable} đang thiếu cột. Hãy chạy file ${cfg.sqlMigrationFile} trong Supabase SQL Editor.`
              : rlsBlocked
                ? `Supabase đang chặn ghi do RLS trên bảng ${cfg.supabaseTable}. Hãy dùng SUPABASE_SERVICE_KEY ở backend hoặc thêm policy INSERT cho role anon/authenticated.`
                : isSupabaseNetworkError(error)
                  ? `Không kết nối được Supabase (lỗi mạng). Kiểm tra internet, firewall và thử lại. Chi tiết: ${error?.message || 'fetch failed'}`
                  : `Không thể ghi ${cfg.entityLabel} vào bảng ${cfg.supabaseTable}. ${error?.message || ''}`.trim()
          });
        }

        return res.status(201).json({
          success: true,
          inserted: records.length,
          mode: 'supabase',
          rows: (insertResult.data || []).map((row) => mapWeighingRow(row as Record<string, unknown>))
        });
      }

      const savedLocally = await store.savePayloadLocally(payload, rows);
      if (savedLocally.ok) {
        return res.status(201).json({
          success: true,
          inserted: records.length,
          mode: 'local',
          rows: savedLocally.rows
        });
      }

      return res.status(500).json({ error: `Không thể lưu ${cfg.entityLabel} local.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || `Lỗi hệ thống khi lưu ${cfg.entityLabel}.` });
    }
  });

  app.patch(`${apiPath}/:id`, async (req, res) => {
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
        const updated = store.updateRecordLocal(id, record);
        if (!updated) {
          return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
        }

        return res.json({ success: true, row: updated, mode: 'local' });
      }

      if (supabase) {
        const dbId = parseWeighingId(id);
        const { data, error } = await supabase
          .from(cfg.supabaseTable)
          .update(record)
          .eq('id', dbId)
          .select('*')
          .maybeSingle();

        if (error) {
          console.error(`Supabase ${cfg.entityLabel} update error:`, error);
          const rlsBlocked = error.code === '42501';
          return res.status(500).json({
            error: rlsBlocked
              ? `Supabase chặn cập nhật do RLS. Chạy ${cfg.sqlMigrationFile} hoặc dùng SUPABASE_SERVICE_KEY.`
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

        const updatedLocally = store.updateRecordLocal(id, record);
        if (updatedLocally) {
          return res.json({ success: true, row: updatedLocally, mode: 'local' });
        }

        return res.status(404).json({ error: 'Không tìm thấy dòng cân.' });
      }

      const updated = store.updateRecordLocal(id, record);
      if (!updated) {
        return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
      }

      return res.json({ success: true, row: updated, mode: 'local' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật dòng cân.' });
    }
  });

  app.delete(`${apiPath}/:id`, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Thiếu ID dòng cân.' });
      }

      if (isLocalWeighingId(id)) {
        const deleted = store.deleteRecordLocal(id);
        if (!deleted) {
          return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
        }

        return res.json({ success: true, mode: 'local' });
      }

      if (supabase) {
        const dbId = parseWeighingId(id);
        const { data, error } = await supabase
          .from(cfg.supabaseTable)
          .delete()
          .eq('id', dbId)
          .select('id')
          .maybeSingle();

        if (error) {
          console.error(`Supabase ${cfg.entityLabel} delete error:`, error);
          const rlsBlocked = error.code === '42501';
          return res.status(500).json({
            error: rlsBlocked
              ? `Supabase chặn xóa do RLS. Chạy ${cfg.sqlMigrationFile} hoặc dùng SUPABASE_SERVICE_KEY.`
              : `Không thể xóa dòng cân. ${error.message}`
          });
        }

        if (data) {
          return res.json({ success: true, mode: 'supabase' });
        }

        const deletedLocally = store.deleteRecordLocal(id);
        if (deletedLocally) {
          return res.json({ success: true, mode: 'local' });
        }

        return res.status(404).json({ error: 'Không tìm thấy dòng cân.' });
      }

      const deleted = store.deleteRecordLocal(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Không tìm thấy dòng cân trong file local.' });
      }

      return res.json({ success: true, mode: 'local' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa dòng cân.' });
    }
  });
}

function parseWeighingId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

function isLocalWeighingId(id: string) {
  return id.startsWith('local_');
}

async function uploadImageToCloudinary(imageDataUrl: string, folder = 'phieu_can_dinh_ki') {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary chưa được cấu hình.');
  }

  const timestamp = Math.round(Date.now() / 1000).toString();
  const safeFolder = folder.trim() || 'phieu_can_dinh_ki';
  const signaturePayload = `folder=${safeFolder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');
  const params = new FormData();
  params.append('file', imageDataUrl);
  params.append('api_key', CLOUDINARY_API_KEY);
  params.append('timestamp', timestamp);
  params.append('folder', safeFolder);
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
    key =>
      (key === 'nhan_su' || /ten/i.test(key)) &&
      !/phong|ban|chi|nhanh|ma_|dang_nhap|mat_khau|password|login/i.test(key) &&
      typeof row[key] === 'string'
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
  const username = pickStaffField(row, ['ten_dang_nhap', 'username', 'login'], '');
  const password = pickStaffField(row, ['mat_khau', 'password'], '');

  return {
    id: code || name,
    code,
    name,
    branch,
    department,
    role,
    position,
    shift,
    status,
    username,
    password
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

function staffWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_STAFF_TABLE} chưa tồn tại. Hãy chạy file supabase-nhan-su.sql trong Supabase SQL Editor.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_STAFF_TABLE} đang thiếu cột. Hãy chạy file supabase-nhan-su.sql.`;
  }
  return `Không thể lưu nhân sự vào ${SUPABASE_STAFF_TABLE}. ${error.message}`;
}

function parseStaffBody(body: unknown): { error: string } | { record: Record<string, string | null> } {
  if (!body || typeof body !== 'object') {
    return { error: 'Dữ liệu không hợp lệ.' };
  }

  const source = body as Record<string, unknown>;
  const name = pickRowField(source, ['nhan_su', 'name', 'ho_ten', 'ten_nhan_vien'], '');
  if (!name) {
    return { error: 'Vui lòng nhập tên nhân sự.' };
  }

  const department = pickRowField(source, ['phong_ban', 'department'], '');
  if (!department) {
    return { error: 'Vui lòng chọn phòng ban.' };
  }

  const branch = pickRowField(source, ['chi_nhanh', 'branch', 'chi_nhanh_lam_viec'], SUPABASE_STAFF_BRANCH);
  const code = pickRowField(source, ['ma_nhan_su', 'ma_nv', 'code'], '');

  return {
    record: {
      nhan_su: name,
      phong_ban: department,
      chi_nhanh: branch,
      cong_viec: pickRowField(source, ['cong_viec', 'Cong_Viec', 'chuc_vu', 'role'], 'Nhân sự'),
      ca_lam: pickRowField(source, ['ca_lam', 'ca', 'shift'], 'Theo phân công'),
      trang_thai: pickRowField(source, ['trang_thai', 'status'], 'Đang làm'),
      ma_nhan_su: code || null,
      ten_dang_nhap: pickRowField(source, ['ten_dang_nhap', 'username', 'login'], '') || null,
      mat_khau: pickRowField(source, ['mat_khau', 'password'], '') || null
    }
  };
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

function respondSupabaseReadError(
  res: express.Response,
  error: { code?: string; message?: string },
  table: string,
  emptyPayload: Record<string, unknown>
) {
  if (isMissingTableError(error)) {
    return res.json({ ...emptyPayload, source: 'local', warning: `Bảng ${table} chưa có trên Supabase.` });
  }
  console.error(`Supabase ${table} error:`, error);
  return res.status(500).json({ error: `Không thể tải từ ${table}. ${error.message}` });
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
    'code', 'ma_sp', 'newCode', 'ma_sp_moi', 'amisCode', 'ma_amis', 'name', 'ten_sp', 'nature', 'tinh_chat', 'group', 'nhom_vthh',
    'unit', 'don_vi', 'openingStock', 'ton_dau_ky', 'inbound', 'nhap_trong_ky', 'outbound', 'xuat_trong_ky',
    'stock', 'sl_ton', 'minStock', 'so_luong_ton_toi_thieu',
    'origin', 'nguon_goc', 'description', 'mo_ta',
    'totalWeight', 'tong_trong_luong', 'rollWidth', 'kho_cuon', 'rollLength', 'chieu_dai_cuon',
    'coreWeight', 'trong_luong_loi', 'bagWeight', 'trong_luong_tui', 'plasticWeight', 'trong_luong_nhua'
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
  if (Object.prototype.hasOwnProperty.call(source, 'amisCode') || Object.prototype.hasOwnProperty.call(source, 'ma_amis')) {
    record.ma_amis = parseMaterialText(source.amisCode ?? source.ma_amis) || null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'totalWeight') || Object.prototype.hasOwnProperty.call(source, 'tong_trong_luong')) {
    record.tong_trong_luong = parseOptionalMaterialNumber(source.totalWeight ?? source.tong_trong_luong);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'rollWidth') || Object.prototype.hasOwnProperty.call(source, 'kho_cuon')) {
    record.kho_cuon = parseOptionalMaterialNumber(source.rollWidth ?? source.kho_cuon);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'rollLength') || Object.prototype.hasOwnProperty.call(source, 'chieu_dai_cuon')) {
    record.chieu_dai_cuon = parseOptionalMaterialNumber(source.rollLength ?? source.chieu_dai_cuon);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'coreWeight') || Object.prototype.hasOwnProperty.call(source, 'trong_luong_loi')) {
    record.trong_luong_loi = parseOptionalMaterialNumber(source.coreWeight ?? source.trong_luong_loi);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'bagWeight') || Object.prototype.hasOwnProperty.call(source, 'trong_luong_tui')) {
    record.trong_luong_tui = parseOptionalMaterialNumber(source.bagWeight ?? source.trong_luong_tui);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'plasticWeight') || Object.prototype.hasOwnProperty.call(source, 'trong_luong_nhua')) {
    record.trong_luong_nhua = parseOptionalMaterialNumber(source.plasticWeight ?? source.trong_luong_nhua);
  }

  return { record };
}

function productWriteErrorMessage(error: { code?: string; message?: string; details?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_PRODUCTS_TABLE} chưa tồn tại trên Supabase.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_PRODUCTS_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-san-pham-dinh-muc.sql.`;
  }
  return `Không thể lưu sản phẩm vào ${SUPABASE_PRODUCTS_TABLE}. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

function parseMixingNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? Math.round(num * 1000) / 1000 : null;
}

function roundMixingWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}

function parseMixingRoundItem(source: unknown): {
  ma_nvl: string;
  ten_vat_tu: string;
  don_vi: string;
  so_luong: number | null;
  kl_thuc_te: number | null;
  ti_le_phan_tram: number | null;
} | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const ma_nvl = String(record.ma_npl ?? record.ma_nvl ?? record.code ?? '').trim();
  const ten_vat_tu = String(record.ten_vat_tu ?? record.ten_npl ?? '').trim();
  const don_vi = String(record.don_vi ?? record.unit ?? 'kg').trim() || 'kg';
  const so_luong = parseMixingNumber(record.so_luong ?? record.so_luong_kg);
  const kl_thuc_te = parseMixingNumber(record.kl_thuc_te ?? record.so_luong_thuc_te);
  const ti_le_phan_tram = parseMixingNumber(record.ti_le_phan_tram ?? record.phan_tram ?? record.percent);
  if (!ma_nvl && !ten_vat_tu && so_luong === null && kl_thuc_te === null && ti_le_phan_tram === null) return null;
  return { ma_nvl, ten_vat_tu, don_vi, so_luong, kl_thuc_te, ti_le_phan_tram };
}

function hasMixingRoundMaterial(phoiTron: Record<string, unknown>) {
  return (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).some(key =>
    parseMixingRoundItems(phoiTron[key]).some(
      item => item.ma_nvl || item.ten_vat_tu || item.so_luong !== null || item.kl_thuc_te !== null
    )
  );
}

function backfillLegacyMixingPhoiTron(
  line: Record<string, unknown>,
  phoiTron: Record<string, unknown>,
  ma_nvl: string,
  ten_vat_tu: string
) {
  if (hasMixingRoundMaterial(phoiTron)) return phoiTron;

  const don_vi = String(line.don_vi ?? line.unit ?? 'kg').trim() || 'kg';
  const tong_nhua_tron = parseMixingNumber(line.tong_nhua_tron);
  const ti_le_phan_tram = parseMixingNumber(line.ti_le_phan_tram ?? line.phan_tram);
  if (!ma_nvl && !ten_vat_tu && tong_nhua_tron === null) return phoiTron;

  return {
    ...phoiTron,
    lan_1: [{ ma_nvl, ten_vat_tu, don_vi, so_luong: tong_nhua_tron, kl_thuc_te: null, ti_le_phan_tram }]
  };
}

function parseMixingRoundItems(source: unknown) {
  if (source === null || source === undefined) return [];
  if (typeof source === 'number') {
    return [{ ma_nvl: '', ten_vat_tu: '', don_vi: 'kg', so_luong: source, kl_thuc_te: null, ti_le_phan_tram: null }];
  }
  if (Array.isArray(source)) {
    return source
      .map(item => parseMixingRoundItem(item))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }
  const single = parseMixingRoundItem(source);
  return single ? [single] : [];
}

function parseMixingPhoiTron(source: unknown) {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const phoiTron: Record<string, unknown> = {};
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const rawItems = record[key];
    const items = parseMixingRoundItems(rawItems);
    if (items.length > 0) {
      if (Array.isArray(rawItems)) {
        phoiTron[key] = items.map((item, index) => {
          const rawItem = rawItems[index];
          if (!rawItem || typeof rawItem !== 'object') return item;
          const kl = parseMixingNumber((rawItem as Record<string, unknown>).kl_thuc_te);
          return kl !== null ? { ...item, kl_thuc_te: kl } : item;
        });
      } else {
        phoiTron[key] = items;
      }
    }
  });
  const rawBatch = record.khoi_luong_me;
  if (rawBatch && typeof rawBatch === 'object') {
    const khoi_luong_me: Record<string, number> = {};
    (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
      const val = parseMixingNumber((rawBatch as Record<string, unknown>)[key]);
      if (val !== null && val > 0) khoi_luong_me[key] = val;
    });
    if (Object.keys(khoi_luong_me).length > 0) phoiTron.khoi_luong_me = khoi_luong_me;
  }
  if (!phoiTron.lan_1) {
    phoiTron.lan_1 = [{ ma_nvl: '', ten_vat_tu: '', don_vi: 'kg', so_luong: null, kl_thuc_te: null, ti_le_phan_tram: null }];
  }
  return phoiTron;
}

function visiblePhoiTronRoundCount(phoiTron: Record<string, unknown>) {
  const keys = ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const;
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    if (phoiTron[keys[index]] !== undefined) return index + 1;
  }
  return 1;
}

function sumPhoiTronActualQuantity(phoiTron: Record<string, unknown>) {
  let total = 0;
  let hasAny = false;
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const items = parseMixingRoundItems(phoiTron[key]);
    items.forEach(item => {
      if (item.kl_thuc_te !== null && item.kl_thuc_te !== undefined) {
        hasAny = true;
        total += item.kl_thuc_te;
      }
    });
  });
  return hasAny ? roundMixingWeight(total) : null;
}

function sumPhoiTronQuantity(phoiTron: Record<string, unknown>) {
  const rawBatch = phoiTron.khoi_luong_me;
  if (rawBatch && typeof rawBatch === 'object') {
    const roundCount = visiblePhoiTronRoundCount(phoiTron);
    let total = 0;
    let hasAny = false;
    (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).slice(0, roundCount).forEach(key => {
      const val = parseMixingNumber((rawBatch as Record<string, unknown>)[key]);
      if (val !== null && val > 0) {
        total += val;
        hasAny = true;
      }
    });
    if (hasAny) return roundMixingWeight(total);
  }

  let total = 0;
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const items = parseMixingRoundItems(phoiTron[key]);
    total += items.reduce((sum, item) => sum + (item.so_luong ?? 0), 0);
  });
  return roundMixingWeight(total);
}

function parseMixingRoundPhotos(source: unknown) {
  let value = source;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const result: Record<string, Array<{ url: string; public_id: string | null }>> = {};

  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const raw = record[key];
    if (!Array.isArray(raw)) return;
    const photos = raw
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const url = String(row.url ?? row.hinh_anh ?? row.imageUrl ?? '').trim();
        if (!url) return null;
        return {
          url,
          public_id: String(row.public_id ?? row.hinh_anh_public_id ?? row.imagePublicId ?? '').trim() || null
        };
      })
      .filter((item): item is { url: string; public_id: string | null } => Boolean(item));
    if (photos.length > 0) result[key] = photos;
  });

  return result;
}

function extractMixingReportPhotosFromChiTiet(chiTietRaw: unknown) {
  if (!Array.isArray(chiTietRaw)) return {};
  for (const line of chiTietRaw) {
    if (!line || typeof line !== 'object') continue;
    const embedded = (line as Record<string, unknown>)._hinh_anh_theo_lan;
    const photos = parseMixingRoundPhotos(embedded);
    if (Object.keys(photos).length > 0) return photos;
  }
  return {};
}

function extractMixingReportPhotos(row: Record<string, unknown>) {
  const fromColumn = parseMixingRoundPhotos(row.hinh_anh_theo_lan);
  if (Object.keys(fromColumn).length > 0) return fromColumn;
  return extractMixingReportPhotosFromChiTiet(row.chi_tiet);
}

function normalizeMixingReasonList(source: unknown) {
  if (!Array.isArray(source)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  source.forEach(item => {
    const value = String(item ?? '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

function parseMixingRoundReasons(source: unknown) {
  let value = source;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const result: Record<string, string[]> = {};
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const reasons = normalizeMixingReasonList(record[key]);
    if (reasons.length > 0) result[key] = reasons;
  });
  return result;
}

function parseMixingRoundExplanations(source: unknown) {
  let value = source;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    const text = String(record[key] ?? '').trim();
    if (text) result[key] = text;
  });
  return result;
}

function mergeMixingRoundReasons(...sources: unknown[]) {
  const result: Record<string, string[]> = {};
  sources.forEach(source => {
    const parsed = parseMixingRoundReasons(source);
    Object.entries(parsed).forEach(([key, values]) => {
      if (values.length > 0) result[key] = values;
    });
  });
  return result;
}

function mergeMixingRoundExplanations(...sources: unknown[]) {
  const result: Record<string, string> = {};
  sources.forEach(source => {
    const parsed = parseMixingRoundExplanations(source);
    Object.entries(parsed).forEach(([key, value]) => {
      if (value) result[key] = value;
    });
  });
  return result;
}

function extractMixingReportReasonsFromChiTiet(chiTietRaw: unknown) {
  if (!Array.isArray(chiTietRaw)) return {};
  for (const line of chiTietRaw) {
    if (!line || typeof line !== 'object') continue;
    const embedded = (line as Record<string, unknown>)._ly_do_theo_lan;
    const reasons = parseMixingRoundReasons(embedded);
    if (Object.keys(reasons).length > 0) return reasons;
  }
  return {};
}

function extractMixingReportExplanationsFromChiTiet(chiTietRaw: unknown) {
  if (!Array.isArray(chiTietRaw)) return {};
  for (const line of chiTietRaw) {
    if (!line || typeof line !== 'object') continue;
    const embedded = (line as Record<string, unknown>)._giai_trinh_theo_lan;
    const explanations = parseMixingRoundExplanations(embedded);
    if (Object.keys(explanations).length > 0) return explanations;
  }
  return {};
}

function extractMixingReportReasons(row: Record<string, unknown>) {
  const fromColumn = parseMixingRoundReasons(row.ly_do_theo_lan);
  if (Object.keys(fromColumn).length > 0) return fromColumn;
  return extractMixingReportReasonsFromChiTiet(row.chi_tiet);
}

function extractMixingReportExplanations(row: Record<string, unknown>) {
  const fromColumn = parseMixingRoundExplanations(row.giai_trinh_theo_lan);
  if (Object.keys(fromColumn).length > 0) return fromColumn;
  const fromReasons = parseMixingRoundReasons(extractMixingReportReasons(row));
  const derived: Record<string, string> = {};
  Object.entries(fromReasons).forEach(([key, reasons]) => {
    if (reasons.length > 0) derived[key] = formatMixingReasonsExplanation(reasons);
  });
  if (Object.keys(derived).length > 0) return derived;
  return extractMixingReportExplanationsFromChiTiet(row.chi_tiet);
}

function formatMixingReasonsExplanation(reasons: string[]) {
  return reasons.map(item => item.trim()).filter(Boolean).join('; ');
}

function embedMixingReportReasonsInChiTiet(
  chi_tiet: Array<Record<string, unknown>>,
  ly_do_theo_lan: Record<string, string[]>,
  giai_trinh_theo_lan: Record<string, string>
) {
  if (chi_tiet.length === 0) return chi_tiet;
  if (Object.keys(ly_do_theo_lan).length === 0 && Object.keys(giai_trinh_theo_lan).length === 0) {
    return chi_tiet;
  }
  return chi_tiet.map((line, index) =>
    index === 0
      ? {
          ...line,
          _ly_do_theo_lan: ly_do_theo_lan,
          _giai_trinh_theo_lan: giai_trinh_theo_lan
        }
      : line
  );
}

function collectMixingReasonSuggestions(rows: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  rows.forEach(row => {
    const reasonsByRound = extractMixingReportReasons(row);
    Object.values(reasonsByRound).forEach(list => {
      list.forEach(reason => {
        const normalized = reason.trim();
        if (normalized) seen.add(normalized);
      });
    });
  });
  return [...seen].sort((left, right) => left.localeCompare(right, 'vi'));
}

function embedMixingReportPhotosInChiTiet(
  chi_tiet: Array<Record<string, unknown>>,
  photos: Record<string, Array<{ url: string; public_id: string | null }>>
) {
  if (chi_tiet.length === 0 || Object.keys(photos).length === 0) return chi_tiet;
  return chi_tiet.map((line, index) =>
    index === 0 ? { ...line, _hinh_anh_theo_lan: photos } : line
  );
}

function embedMixingReportLanThuInChiTiet(chi_tiet: Array<Record<string, unknown>>, lan_thu: number) {
  if (chi_tiet.length === 0 || !Number.isFinite(lan_thu) || lan_thu <= 0) return chi_tiet;
  return chi_tiet.map((line, index) => (index === 0 ? { ...line, _lan_thu: lan_thu } : line));
}

function extractMixingReportLanThu(row: Record<string, unknown>) {
  const fromColumn = Number(row.lan_thu);
  if (Number.isFinite(fromColumn) && fromColumn > 0) return fromColumn;
  return extractMixingReportLanThuFromChiTiet(row.chi_tiet);
}

function extractMixingReportLanThuFromChiTiet(chiTietRaw: unknown) {
  if (!Array.isArray(chiTietRaw)) return 1;
  for (const line of chiTietRaw) {
    if (!line || typeof line !== 'object') continue;
    const embedded = Number((line as Record<string, unknown>)._lan_thu);
    if (Number.isFinite(embedded) && embedded > 0) return embedded;
  }
  return 1;
}

function isMissingMixingPhotosColumnError(error: { code?: string; message?: string } | null) {
  return (
    isMissingColumnError(error) &&
    String(error?.message ?? '')
      .toLowerCase()
      .includes('hinh_anh_theo_lan')
  );
}

function isMissingMixingLanThuColumnError(error: { code?: string; message?: string } | null) {
  return (
    isMissingColumnError(error) &&
    String(error?.message ?? '')
      .toLowerCase()
      .includes('lan_thu')
  );
}

function isMissingMixingReasonColumnError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    isMissingColumnError(error) &&
    (message.includes('ly_do_theo_lan') || message.includes('giai_trinh_theo_lan'))
  );
}

async function writeMixingReportRecord(
  record: Record<string, unknown>,
  mode: 'insert' | 'update',
  id?: string
) {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.');

  const runWrite = (payload: Record<string, unknown>) => {
    if (mode === 'insert') {
      return supabase.from(SUPABASE_MIXING_REPORTS_TABLE).insert(payload).select('*').single();
    }
    return supabase.from(SUPABASE_MIXING_REPORTS_TABLE).update(payload).eq('id', id).select('*').single();
  };

  let payload = { ...record };
  let result = await runWrite(payload);

  while (result.error && isMissingColumnError(result.error)) {
    const nextPayload = { ...payload };
    let changed = false;

    if (isMissingMixingPhotosColumnError(result.error)) {
      delete nextPayload.hinh_anh_theo_lan;
      changed = true;
    }
    if (isMissingMixingLanThuColumnError(result.error)) {
      delete nextPayload.lan_thu;
      changed = true;
    }
    if (isMissingMixingReasonColumnError(result.error)) {
      delete nextPayload.ly_do_theo_lan;
      delete nextPayload.giai_trinh_theo_lan;
      changed = true;
    }

    if (!changed) break;
    payload = nextPayload;
    result = await runWrite(payload);
  }

  return result;
}

function backfillMixingItemKlFromLine(
  phoiTron: Record<string, unknown>,
  ma_nvl: string,
  ten_vat_tu: string,
  kl: number
) {
  const hasItemKl = (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).some(key =>
    parseMixingRoundItems(phoiTron[key]).some(
      item => item.kl_thuc_te !== null && item.kl_thuc_te !== undefined
    )
  );
  if (hasItemKl) return phoiTron;

  const codeKey = ma_nvl.trim().toLowerCase() || ten_vat_tu.trim().toLowerCase();
  for (const key of ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const) {
    const items = parseMixingRoundItems(phoiTron[key]);
    if (items.length === 0) continue;
    const updated = items.map(item => {
      const itemKey = (item.ma_nvl || item.ten_vat_tu).trim().toLowerCase();
      const matches = !codeKey || !itemKey || codeKey === itemKey || items.length === 1;
      return matches ? { ...item, kl_thuc_te: kl } : item;
    });
    return { ...phoiTron, [key]: updated };
  }
  return phoiTron;
}

function resolveMixingLineKlFromPhoiTron(
  phoiTron: Record<string, unknown>,
  lineKl: number | null
) {
  let total = 0;
  let hasAny = false;
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    parseMixingRoundItems(phoiTron[key]).forEach(item => {
      if (item.kl_thuc_te !== null && item.kl_thuc_te !== undefined) {
        hasAny = true;
        total += item.kl_thuc_te;
      }
    });
  });
  if (hasAny) return Math.round(total * 100) / 100;
  return lineKl;
}

function parseMixingReportLine(source: unknown, index: number) {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  let lan_su_dung = parseMixingPhoiTron(record.lan_su_dung);
  const derivedMa = String(record.ma_npl ?? record.ma_nvl ?? record.code ?? '').trim();
  const derivedTen = String(record.ten_vat_tu ?? record.ten_npl ?? record.name ?? '').trim();
  const ma_nvl = derivedMa || (() => {
    for (const key of ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const) {
      for (const item of parseMixingRoundItems(lan_su_dung[key])) {
        if (item.ma_nvl) return item.ma_nvl;
      }
    }
    return '';
  })();
  const ten_vat_tu = derivedTen || (() => {
    for (const key of ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const) {
      for (const item of parseMixingRoundItems(lan_su_dung[key])) {
        if (item.ten_vat_tu) return item.ten_vat_tu;
      }
    }
    return '';
  })();
  if (!ma_nvl && !ten_vat_tu) return null;

  lan_su_dung = backfillLegacyMixingPhoiTron(record, lan_su_dung, ma_nvl, ten_vat_tu);
  const lineKl = parseMixingNumber(record.kl_thuc_te ?? record.so_luong_thuc_te);
  if (lineKl !== null) {
    lan_su_dung = backfillMixingItemKlFromLine(lan_su_dung, ma_nvl, ten_vat_tu, lineKl);
  }
  const tongFromRounds = sumPhoiTronQuantity(lan_su_dung);
  const kl_thuc_te = resolveMixingLineKlFromPhoiTron(lan_su_dung, lineKl);

  return {
    stt: Number(record.stt ?? index + 1) || index + 1,
    ma_nvl,
    ten_vat_tu,
    lan_su_dung,
    kl_thuc_te,
    tong_nhua_tron:
      parseMixingNumber(record.tong_nhua_tron) ?? (tongFromRounds > 0 ? tongFromRounds : null),
    hinh_anh: String(record.hinh_anh ?? record.imageUrl ?? '').trim() || null,
    hinh_anh_public_id: String(record.hinh_anh_public_id ?? record.imagePublicId ?? '').trim() || null
  };
}

function parseMixingReportBody(body: unknown): { error: string } | { record: Record<string, unknown> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ca = String(source.ca ?? '').trim();
  const ngay = String(source.ngay ?? '').trim();
  const ma_may = String(source.ma_may ?? source.machineCode ?? '').trim();
  const ten_may = String(source.ten_may ?? source.machineName ?? '').trim();

  if (!ca) return { error: 'Vui lòng nhập ca.' };
  if (!ngay) return { error: 'Vui lòng chọn ngày.' };
  if (!ma_may && !ten_may) return { error: 'Vui lòng chọn máy.' };

  const chiTietRaw = source.chi_tiet ?? source.lines ?? source.items;
  const list = Array.isArray(chiTietRaw) ? chiTietRaw : [];
  const chi_tiet = list
    .map((line, index) => parseMixingReportLine(line, index))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  if (chi_tiet.length === 0) {
    return { error: 'Vui lòng nhập ít nhất một dòng vật tư.' };
  }

  const thuc_te_su_dung =
    parseMixingNumber(source.thuc_te_su_dung) ??
    Math.round(
      chi_tiet.reduce((sum, line) => {
        const actual = sumPhoiTronActualQuantity(line.lan_su_dung as Record<string, unknown>);
        if (actual !== null) return sum + actual;
        return sum + (line.tong_nhua_tron ?? 0);
      }, 0) * 100
    ) / 100;

  const so_lan = Math.min(
    5,
    Math.max(
      1,
      Number(source.so_lan) ||
        chi_tiet.reduce(
          (max, line) => Math.max(max, visiblePhoiTronRoundCount(line.lan_su_dung as Record<string, unknown>)),
          1
        )
    )
  );

  const hinh_anh_theo_lan = parseMixingRoundPhotos(source.hinh_anh_theo_lan);
  const ly_do_theo_lan = mergeMixingRoundReasons(
    source.ly_do_theo_lan,
    extractMixingReportReasonsFromChiTiet(chiTietRaw)
  );
  const giai_trinh_theo_lan = mergeMixingRoundExplanations(
    source.giai_trinh_theo_lan,
    extractMixingReportExplanationsFromChiTiet(chiTietRaw)
  );
  (['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const).forEach(key => {
    if (!giai_trinh_theo_lan[key] && ly_do_theo_lan[key]?.length) {
      giai_trinh_theo_lan[key] = formatMixingReasonsExplanation(ly_do_theo_lan[key]);
    }
  });
  const lan_thu = Math.min(
    5,
    Math.max(1, Number(source.lan_thu) || 1)
  );
  let chi_tiet_with_photos = embedMixingReportPhotosInChiTiet(chi_tiet, hinh_anh_theo_lan);
  chi_tiet_with_photos = embedMixingReportReasonsInChiTiet(
    chi_tiet_with_photos,
    ly_do_theo_lan,
    giai_trinh_theo_lan
  );
  chi_tiet_with_photos = embedMixingReportLanThuInChiTiet(chi_tiet_with_photos, lan_thu);

  return {
    record: {
      ca,
      ngay,
      gio: String(source.gio ?? '').trim() || null,
      chi_nhanh: String(source.chi_nhanh ?? source.branch ?? '').trim() || null,
      ma_may: ma_may || null,
      ten_may: ten_may || null,
      nhan_su: String(source.nhan_su ?? source.staff ?? '').trim() || null,
      so_phieu: String(source.so_phieu ?? source.documentNo ?? '').trim() || null,
      ky_hieu: String(source.ky_hieu ?? 'QT-16-BM02').trim() || 'QT-16-BM02',
      lan_thu,
      so_lan,
      thuc_te_su_dung,
      ghi_chu: String(source.ghi_chu ?? source.note ?? '').trim() || null,
      hinh_anh_theo_lan,
      ly_do_theo_lan,
      giai_trinh_theo_lan,
      chi_tiet: chi_tiet_with_photos
    }
  };
}

function mixingReportWriteError(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_MIXING_REPORTS_TABLE} chưa tồn tại. Hãy chạy supabase-bao-cao-phoi-tron.sql.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_MIXING_REPORTS_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-bao-cao-phoi-tron.sql.`;
  }
  return `Không thể lưu báo cáo phối trộn. ${error.message || ''}`.trim();
}

function parseMachineNvlReportKind(value: unknown): 'dau_ca' | 'cuoi_ca' {
  const raw = String(value ?? 'dau_ca').trim().toLowerCase();
  if (raw === 'cuoi_ca' || raw === 'cuoi' || raw === 'cuoi-ca') return 'cuoi_ca';
  return 'dau_ca';
}

function parseMachineNvlReportLine(source: unknown, index: number) {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const ma_nvl = String(record.ma_nvl ?? record.ma_npl ?? record.code ?? '').trim();
  const ten_nvl = String(record.ten_nvl ?? record.ten_npl ?? record.name ?? '').trim();
  const don_vi = String(record.don_vi ?? record.unit ?? 'kg').trim() || 'kg';
  const so_luong_ton = parseMixingNumber(record.so_luong_ton ?? record.so_luong ?? record.quantity);
  const so_luong_trong_may = parseMixingNumber(
    record.so_luong_trong_may ?? record.ton_trong_may ?? record.inMachineQuantity
  );
  const so_luong_trong_bon_tron = parseMixingNumber(
    record.so_luong_trong_bon_tron ?? record.ton_trong_bon_tron ?? record.inMixerQuantity
  );
  const so_luong_nl_chua_tron = parseMixingNumber(
    record.so_luong_nl_chua_tron ?? record.nl_chua_tron ?? record.unblendedQuantity
  );
  const so_luong_ton_dinh_muc = parseMixingNumber(
    record.so_luong_ton_dinh_muc ?? record.so_luong_dinh_muc ?? record.standardQuantity
  );
  const so_luong_ton_ca_truoc = parseMixingNumber(
    record.so_luong_ton_ca_truoc ?? record.so_luong_ca_truoc ?? record.previousQuantity
  );
  const ghi_chu = String(record.ghi_chu ?? record.note ?? '').trim();

  if (
    !ma_nvl &&
    !ten_nvl &&
    so_luong_ton === null &&
    so_luong_trong_may === null &&
    so_luong_trong_bon_tron === null &&
    so_luong_nl_chua_tron === null &&
    so_luong_ton_dinh_muc === null &&
    so_luong_ton_ca_truoc === null
  ) {
    return null;
  }

  return {
    stt: Number(record.stt ?? index + 1) || index + 1,
    ma_nvl,
    ten_nvl,
    don_vi,
    ...(so_luong_trong_may !== null ? { so_luong_trong_may } : {}),
    ...(so_luong_trong_bon_tron !== null ? { so_luong_trong_bon_tron } : {}),
    ...(so_luong_nl_chua_tron !== null ? { so_luong_nl_chua_tron } : {}),
    ...(so_luong_ton_dinh_muc !== null ? { so_luong_ton_dinh_muc } : {}),
    so_luong_ton:
      so_luong_ton ??
      Math.round(
        ((so_luong_trong_may ?? 0) + (so_luong_trong_bon_tron ?? 0) + (so_luong_nl_chua_tron ?? 0)) * 100
      ) / 100,
    ...(so_luong_ton_ca_truoc !== null ? { so_luong_ton_ca_truoc } : {}),
    ghi_chu
  };
}

function parseMachineNvlReportBody(body: unknown): { error: string } | { record: Record<string, unknown> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ngay = String(source.ngay ?? '').trim();
  const ca = String(source.ca ?? '').trim();
  const ma_may = String(source.ma_may ?? source.machineCode ?? '').trim();
  const ten_may = String(source.ten_may ?? source.machineName ?? '').trim();

  if (!ngay) return { error: 'Vui lòng chọn ngày.' };
  if (!ca) return { error: 'Vui lòng chọn ca.' };
  if (!ma_may && !ten_may) return { error: 'Vui lòng chọn máy.' };

  const rawLines = source.chi_tiet ?? source.lines ?? source.items;
  const list = Array.isArray(rawLines) ? rawLines : [];
  const chi_tiet = list
    .map((line, index) => parseMachineNvlReportLine(line, index))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  if (chi_tiet.length === 0) {
    return { error: 'Vui lòng nhập ít nhất một dòng NVL tồn theo máy.' };
  }

  const tong_so_luong_ton =
    Math.round(chi_tiet.reduce((sum, line) => sum + (line.so_luong_ton ?? 0), 0) * 100) / 100;

  return {
    record: {
      ngay,
      ca,
      loai_bao_cao: parseMachineNvlReportKind(source.loai_bao_cao ?? source.loai ?? source.reportKind),
      gio: String(source.gio ?? '').trim() || null,
      ma_may: ma_may || null,
      ten_may: ten_may || null,
      nhan_su: String(source.nhan_su ?? source.staff ?? '').trim() || null,
      tong_so_luong_ton,
      ghi_chu: String(source.ghi_chu ?? source.note ?? '').trim() || null,
      chi_tiet
    }
  };
}

function machineNvlReportWriteError(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_MACHINE_NVL_REPORTS_TABLE} chưa tồn tại. Hãy chạy supabase-bao-cao-may-nvl-ton.sql.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_MACHINE_NVL_REPORTS_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-bao-cao-may-nvl-ton-loai.sql hoặc supabase-bao-cao-may-nvl-ton.sql.`;
  }
  return `Không thể lưu báo cáo NVL tồn theo máy. ${error.message || ''}`.trim();
}

function parseDowntimeTime(value: unknown) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function calcDowntimeMinutes(start: string, end: string) {
  if (!start || !end) return null;
  const startMatch = start.match(/^(\d{1,2}):(\d{2})/);
  const endMatch = end.match(/^(\d{1,2}):(\d{2})/);
  if (!startMatch || !endMatch) return null;

  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  let endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;

  const diff = endMinutes - startMinutes;
  return Number.isFinite(diff) && diff >= 0 ? Math.round(diff * 100) / 100 : null;
}

function generateMachineDowntimeSlipCode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time =
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `BDM-${date}-${time}`;
}

function parseMachineDowntimeLine(source: unknown, index: number) {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const thoi_gian_bat_dau = parseDowntimeTime(
    record.thoi_gian_bat_dau ?? record.thoiGianBatDau ?? record.startTime
  );
  const thoi_gian_chay_lai = parseDowntimeTime(
    record.thoi_gian_chay_lai ?? record.thoiGianChayLai ?? record.restartTime
  );
  const ly_do_dung_may = String(record.ly_do_dung_may ?? record.lyDo ?? record.reason ?? '').trim();
  const so_cuon_anh_huong = parseMixingNumber(
    record.so_cuon_anh_huong ?? record.soCuon ?? record.rollsAffected
  );
  const nguoi_xac_nhan = String(record.nguoi_xac_nhan ?? record.confirmedBy ?? '').trim();
  const ghi_chu = String(record.ghi_chu ?? record.note ?? '').trim();
  const providedMinutes = parseMixingNumber(
    record.tong_thoi_gian_dung_phut ?? record.downtimeMinutes ?? record.totalMinutes
  );
  const computedMinutes = calcDowntimeMinutes(thoi_gian_bat_dau, thoi_gian_chay_lai);
  const tong_thoi_gian_dung_phut =
    providedMinutes !== null ? providedMinutes : computedMinutes !== null ? computedMinutes : null;

  if (!thoi_gian_bat_dau && !thoi_gian_chay_lai && !ly_do_dung_may && so_cuon_anh_huong === null) {
    return null;
  }

  return {
    stt: Number(record.stt ?? index + 1) || index + 1,
    thoi_gian_bat_dau,
    thoi_gian_chay_lai,
    tong_thoi_gian_dung_phut: tong_thoi_gian_dung_phut ?? 0,
    ly_do_dung_may,
    so_cuon_anh_huong: so_cuon_anh_huong ?? 0,
    nguoi_xac_nhan,
    ghi_chu
  };
}

function parseMachineDowntimeBody(body: unknown): { error: string } | { record: Record<string, unknown> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ngay = String(source.ngay ?? '').trim();
  const ca = String(source.ca ?? '').trim();
  const ma_may = String(source.ma_may ?? source.machineCode ?? '').trim();
  const ten_may = String(source.ten_may ?? source.machineName ?? '').trim();

  if (!ngay) return { error: 'Vui lòng chọn ngày.' };
  if (!ca) return { error: 'Vui lòng chọn ca.' };
  if (!ma_may && !ten_may) return { error: 'Vui lòng chọn máy.' };

  const rawLines = source.chi_tiet ?? source.lines ?? source.items;
  const list = Array.isArray(rawLines) ? rawLines : [];
  const chi_tiet = list
    .map((line, index) => parseMachineDowntimeLine(line, index))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  if (chi_tiet.length === 0) {
    return { error: 'Vui lòng nhập ít nhất một dòng dừng máy.' };
  }

  for (const line of chi_tiet) {
    if (!line.thoi_gian_bat_dau || !line.thoi_gian_chay_lai) {
      return { error: `Dòng ${line.stt}: vui lòng nhập thời gian bắt đầu dừng và thời gian chạy lại.` };
    }
    if (!line.ly_do_dung_may) {
      return { error: `Dòng ${line.stt}: vui lòng nhập lý do dừng máy.` };
    }
  }

  const tong_thoi_gian_dung_phut =
    Math.round(chi_tiet.reduce((sum, line) => sum + (line.tong_thoi_gian_dung_phut ?? 0), 0) * 100) / 100;
  const tong_cuon_anh_huong =
    Math.round(chi_tiet.reduce((sum, line) => sum + (line.so_cuon_anh_huong ?? 0), 0) * 100) / 100;

  const so_phieu =
    String(source.so_phieu ?? source.slipCode ?? '').trim() || generateMachineDowntimeSlipCode();

  return {
    record: {
      so_phieu,
      ngay,
      ca,
      ma_may: ma_may || null,
      ten_may: ten_may || null,
      nguoi_lap: String(source.nguoi_lap ?? source.preparedBy ?? '').trim() || null,
      lenh_sx_lien_quan: String(source.lenh_sx_lien_quan ?? source.productionOrder ?? '').trim() || null,
      tong_thoi_gian_dung_phut,
      tong_cuon_anh_huong,
      ghi_chu_chung: String(source.ghi_chu_chung ?? source.note ?? '').trim() || null,
      chi_tiet,
      nguoi_lap_ky: String(source.nguoi_lap_ky ?? '').trim() || null,
      truong_ca_ky: String(source.truong_ca_ky ?? '').trim() || null,
      bo_phan_ky: String(source.bo_phan_ky ?? '').trim() || null
    }
  };
}

function machineDowntimeWriteError(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_MACHINE_DOWNTIME_TABLE} chưa tồn tại. Hãy chạy supabase-phieu-bao-dung-may.sql.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_MACHINE_DOWNTIME_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-phieu-bao-dung-may.sql.`;
  }
  return `Không thể lưu phiếu báo dừng máy. ${error.message || ''}`.trim();
}

function parseAcceptanceNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function parseAcceptanceReportBody(body: unknown): { error: string } | { record: Record<string, unknown> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ngay = String(source.ngay ?? '').trim();
  const ca = String(source.ca ?? '').trim();
  const lan = String(source.lan ?? '').trim();
  const mat_hang = String(source.mat_hang ?? source.product ?? '').trim();
  const so_luong = parseAcceptanceNumber(source.so_luong ?? source.quantity);

  if (!ngay) return { error: 'Vui lòng chọn ngày.' };
  if (!ca) return { error: 'Vui lòng chọn ca.' };
  if (!lan) return { error: 'Vui lòng nhập lần ghi nhận.' };
  const ma_may = String(source.ma_may ?? source.machineCode ?? '').trim();
  const ten_may = String(source.ten_may ?? source.machineName ?? source.may ?? '').trim();
  if (!ma_may && !ten_may) return { error: 'Vui lòng chọn máy.' };
  if (!mat_hang) return { error: 'Vui lòng nhập mặt hàng.' };
  if (so_luong === null || so_luong <= 0) return { error: 'Số lượng phải lớn hơn 0.' };

  const hinh_anh = String(source.hinh_anh ?? source.imageUrl ?? '').trim();
  if (!hinh_anh) return { error: 'Vui lòng chụp hoặc tải ảnh sản lượng.' };

  return {
    record: {
      ngay,
      ca,
      lan,
      gio: String(source.gio ?? '').trim() || null,
      ma_may: ma_may || null,
      ten_may: ten_may || null,
      mat_hang,
      don_vi: String(source.don_vi ?? source.unit ?? '').trim() || null,
      so_luong,
      hinh_anh,
      hinh_anh_public_id: String(source.hinh_anh_public_id ?? source.imagePublicId ?? '').trim() || null
    }
  };
}

function acceptanceReportWriteError(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_ACCEPTANCE_REPORTS_TABLE} chưa tồn tại. Hãy chạy supabase-bao-cao-nghiem-thu.sql.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_ACCEPTANCE_REPORTS_TABLE} đang thiếu cột (${error.message}). Hãy chạy supabase-bao-cao-nghiem-thu.sql.`;
  }
  return `Không thể lưu báo cáo sản lượng. ${error.message || ''}`.trim();
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
  client: SupabaseClient,
  payload: SettingWritePayload,
  id?: string
) {
  const { fullRecord, coreRecord, startTime, endTime, note } = payload;
  const write = (record: Record<string, string>) =>
    id
      ? client.from(SUPABASE_SETTINGS_TABLE).update(record).eq('id', id).select('*').single()
      : client.from(SUPABASE_SETTINGS_TABLE).insert(record).select('*').single();

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

function isUuidValue(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function resolveMaterialRowFilter(id: string) {
  const value = id.trim();
  if (!value) return null;
  if (isUuidValue(value)) return { column: 'id' as const, value };
  return { column: 'ma_npl' as const, value };
}

function isMaterialKgUnitValue(value: unknown) {
  return String(value ?? '').trim().toLowerCase() === 'kg';
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
  documentQuantity?: number;
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
    const quantity = parseOptionalMaterialNumber(record.quantity ?? record.so_luong);
    const documentQuantity = parseOptionalMaterialNumber(
      record.documentQuantity ?? record.so_luong_chung_tu ?? record.document_qty
    );
    const unitPriceRaw = record.unitPrice ?? record.don_gia ?? record.price ?? record.gia;
    const unitPrice = parseOptionalMaterialNumber(unitPriceRaw) ?? 0;

    if (!code) {
      return { error: loaiKho === 'san_pham' ? 'Mỗi dòng cần có mã sản phẩm.' : 'Mỗi dòng cần có mã NPL.' };
    }
    if (quantity === null || quantity <= 0) {
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
      documentQuantity:
        documentQuantity !== null && documentQuantity > 0
          ? roundWarehouseMoney(documentQuantity)
          : undefined,
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
  ca: string | null;
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
    ca: String(source.ca ?? source.shift ?? source.ca_san_xuat ?? '').trim() || null,
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
  if (String(error.message || '').includes('invalid input syntax for type integer')) {
    return 'Không thể lưu phiếu xuất nhập kho: cột số lượng trên Supabase đang là kiểu integer (chỉ nhận số nguyên). Hãy chạy file supabase-phieu-xuat-nhap-kho-so-luong-numeric.sql trong Supabase SQL Editor, hoặc đặt SUPABASE_DB_PASSWORD trong .env rồi chạy npm run migrate:warehouse-numeric.';
  }
  return `Không thể lưu phiếu xuất nhập kho. ${error.message}${error.details ? ` (${error.details})` : ''}`;
}

async function ensureWarehouseSlipNumericColumns() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password || !SUPABASE_URL) return;

  const ref = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) return;

  const sqlPath = path.join(process.cwd(), 'supabase-phieu-xuat-nhap-kho-so-luong-numeric.sql');
  if (!fs.existsSync(sqlPath)) return;

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const customUrl = process.env.SUPABASE_DB_URL?.trim();
  const candidates = [
    customUrl,
    `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
  ].filter((value): value is string => Boolean(value));

  try {
    const pg = await import('pg');
    for (const connectionString of candidates) {
      const client = new pg.default.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        await client.query(sql);
        console.log('[warehouse] Đã chuyển cột so_luong/don_gia/thanh_tien sang numeric.');
        await client.end();
        return;
      } catch (error) {
        try {
          await client.end();
        } catch {
          // ignore
        }
      }
    }
  } catch (error) {
    console.warn('[warehouse] Không thể tự chạy migration numeric:', error);
  }
}

function parseOrderQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

type OrderProductRecord = {
  ma_don_hang?: string;
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  so_luong: number | null;
};

function parseOrderProductsInput(
  source: Record<string, unknown>
): { error: string } | { products: OrderProductRecord[] } {
  const raw = source.products ?? source.san_pham;

  if (raw === undefined || raw === null || raw === '') {
    return { error: 'Vui lòng thêm ít nhất một sản phẩm.' };
  }

  if (!Array.isArray(raw)) {
    return { error: 'Sản phẩm phải là danh sách.' };
  }

  const products: OrderProductRecord[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const ma_sp = pickRowField(row, ['ma_sp', 'ma_hang', 'productCode', 'code']);
    const ten_sp = pickRowField(row, ['ten_sp', 'ten_hang', 'productName', 'name']);
    const don_vi = pickRowField(row, ['don_vi', 'unit']);
    const so_luong = parseOrderQuantity(row.so_luong ?? row.quantity);
    const ma_don_hang = pickRowField(row, ['ma_don_hang', 'orderRef', 'order_code']);

    if (!ma_sp && !ten_sp) {
      return { error: 'Mỗi dòng sản phẩm cần có mã SP hoặc tên SP.' };
    }
    if (so_luong === null || so_luong <= 0) {
      return { error: `Số lượng phải lớn hơn 0 cho sản phẩm ${ma_sp || ten_sp}.` };
    }

    products.push({ ma_don_hang, ma_sp, ten_sp, don_vi, so_luong });
  }

  if (products.length === 0) {
    return { error: 'Vui lòng thêm ít nhất một sản phẩm.' };
  }

  return { products };
}

function parseOrderProductsFromRow(row: Record<string, unknown>): OrderProductRecord[] {
  let sanPham = row.san_pham;
  if (typeof sanPham === 'string') {
    const trimmed = sanPham.trim();
    if (trimmed) {
      try {
        sanPham = JSON.parse(trimmed);
      } catch {
        sanPham = trimmed;
      }
    }
  }
  if (sanPham && typeof sanPham === 'object' && !Array.isArray(sanPham)) {
    const nested =
      (sanPham as { items?: unknown }).items ??
      (sanPham as { products?: unknown }).products ??
      (sanPham as { san_pham?: unknown }).san_pham;
    if (Array.isArray(nested)) {
      sanPham = nested;
    }
  }
  if (Array.isArray(sanPham) && sanPham.length > 0) {
    return sanPham
      .map((item): OrderProductRecord | null => {
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const ma_sp = pickRowField(record, ['ma_sp', 'ma_hang', 'productCode', 'code']);
        const ten_sp = pickRowField(record, ['ten_sp', 'ten_hang', 'productName', 'name']);
        if (!ma_sp && !ten_sp) return null;
        return {
          ma_don_hang: pickRowField(record, ['ma_don_hang', 'orderRef', 'order_code']),
          ma_sp,
          ten_sp,
          don_vi: pickRowField(record, ['don_vi', 'unit']),
          so_luong: parseOrderQuantity(record.so_luong ?? record.quantity)
        };
      })
      .filter((item): item is OrderProductRecord => Boolean(item));
  }

  const ma_sp = pickRowField(row, ['ma_hang', 'ma_sp', 'productCode']);
  const ten_sp = pickRowField(row, ['ten_hang', 'ten_sp', 'productName']);
  if (!ma_sp && !ten_sp) return [];

  return [
    {
      ma_don_hang: pickRowField(row, ['ma_don_hang', 'orderRef', 'order_code']),
      ma_sp,
      ten_sp,
      don_vi: pickRowField(row, ['don_vi', 'unit']),
      so_luong: parseOrderQuantity(row.so_luong ?? row.quantity)
    }
  ];
}

function getOrderedQuantityFromOrderRow(row: Record<string, unknown>, productCode: string): number {
  return parseOrderProductsFromRow(row).reduce((sum, item) => {
    if (item.ma_sp !== productCode) return sum;
    return sum + (item.so_luong ?? 0);
  }, 0);
}

function parseOrderBody(
  body: unknown,
  options?: { isCreate?: boolean }
): { error: string } | { record: Record<string, string | number | null | OrderProductRecord[]> } {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const orderCode = typeof source.orderCode === 'string' ? source.orderCode.trim() : '';

  if (!orderCode) return { error: 'Vui lòng nhập mã đơn hàng.' };

  const parsedProducts = parseOrderProductsInput(source);
  if ('error' in parsedProducts) {
    return { error: parsedProducts.error };
  }

  const { products } = parsedProducts;

  const DEFAULT_ORDER_STATUS = 'Chờ sx';
  const status = options?.isCreate
    ? DEFAULT_ORDER_STATUS
    : typeof source.status === 'string' && source.status.trim()
      ? source.status.trim()
      : DEFAULT_ORDER_STATUS;

  const record: Record<string, string | number | null | OrderProductRecord[]> = {
    ma_don_hang: orderCode,
    loai_don_hang: typeof source.orderType === 'string' ? source.orderType.trim() : '',
    trang_thai: status,
    nhan_vien: typeof source.staffName === 'string' ? source.staffName.trim() : '',
    khach_hang: typeof source.customer === 'string' ? source.customer.trim() : '',
    san_pham: products,
    ghi_chu: typeof source.note === 'string' ? source.note.trim() : ''
  };

  if (Object.prototype.hasOwnProperty.call(source, 'stockQuantity')) {
    record.so_luong_ton = parseOrderQuantity(source.stockQuantity);
  }
  if (Object.prototype.hasOwnProperty.call(source, 'productionOrder')) {
    record.lenh_sx = typeof source.productionOrder === 'string' ? source.productionOrder.trim() : '';
  }

  return { record };
}

function orderWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_ORDERS_TABLE} chưa tồn tại trong Supabase.`;
  }
  if (isMissingColumnError(error)) {
    const detail = error.message ? ` (${error.message})` : '';
    return `Bảng ${SUPABASE_ORDERS_TABLE} đang thiếu cột${detail}. Hãy chạy file supabase-don-hang-san-pham.sql trong Supabase SQL Editor.`;
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

function generateNextStaffCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^NV(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  const width = Math.max(3, String(next).length);
  return `NV${String(next).padStart(width, '0')}`;
}

async function generateNextStaffCodeFromDb() {
  if (!supabase) return 'NV001';
  const { data, error } = await supabase.from(SUPABASE_STAFF_TABLE).select('ma_nhan_su');
  if (error) {
    console.error('Supabase nhan_su next code query error:', error);
    return 'NV001';
  }
  return generateNextStaffCode((data || []).map(row => String((row as { ma_nhan_su?: string }).ma_nhan_su || '')));
}

function generateNextOrderCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^DH(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  const width = Math.max(3, String(next).length);
  return `DH${String(next).padStart(width, '0')}`;
}

async function generateNextOrderCodeFromDb() {
  if (!supabase) return 'DH001';
  const { data, error } = await supabase.from(SUPABASE_ORDERS_TABLE).select('ma_don_hang');
  if (error) {
    console.error('Supabase don_hang next code query error:', error);
    return 'DH001';
  }
  return generateNextOrderCode((data || []).map(row => String((row as { ma_don_hang?: string }).ma_don_hang || '')));
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
  code: string,
  product?: OrderProductRecord
): Record<string, string | number | null> {
  const orderCode = pickRowField(order, ['ma_don_hang', 'order_code', 'code']);
  const selectedProduct = product ?? parseOrderProductsFromRow(order)[0];
  const productCode = selectedProduct?.ma_sp ?? '';
  const productName = selectedProduct?.ten_sp ?? '';
  const customer = pickRowField(order, ['khach_hang', 'customer']);
  const unit = selectedProduct?.don_vi ?? '';
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
    so_luong: selectedProduct?.so_luong ?? null,
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

function parseProductionOrderProductsInput(source: Record<string, unknown>): OrderProductRecord[] | null {
  const raw = source.san_pham ?? source.products;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const products: OrderProductRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const ma_sp = pickRowField(row, ['ma_sp', 'ma_hang', 'productCode', 'code']);
    const ten_sp = pickRowField(row, ['ten_sp', 'ten_hang', 'productName', 'name']);
    const don_vi = pickRowField(row, ['don_vi', 'unit']);
    const so_luong = parseOrderQuantity(row.so_luong ?? row.quantity);
    const ma_don_hang = pickRowField(row, ['ma_don_hang', 'orderRef', 'order_code']);

    if (!ma_sp && !ten_sp) {
      return null;
    }
    if (!Number.isFinite(so_luong) || so_luong <= 0) {
      return null;
    }

    products.push({ ma_don_hang, ma_sp, ten_sp, don_vi, so_luong });
  }

  return products.length > 0 ? products : null;
}

function summarizeProductionOrderProducts(products: OrderProductRecord[]) {
  const productCode = products.map(item => item.ma_sp).filter(Boolean).join(', ');
  const productName = products.map(item => item.ten_sp).filter(Boolean).join(', ');
  const units = [...new Set(products.map(item => item.don_vi).filter(unit => unit && unit !== '-'))];
  const quantity = products.reduce((sum, item) => sum + (item.so_luong ?? 0), 0);

  return {
    productCode,
    productName,
    unit: products.length === 1 ? products[0].don_vi ?? '' : units.join(', '),
    quantity
  };
}

function parseProductionOrderBody(
  body: unknown
): { error: string } | { record: Record<string, string | number | null | OrderProductRecord[]> } {
  if (!body || typeof body !== 'object') {
    return { error: 'Dữ liệu không hợp lệ.' };
  }

  const source = body as Record<string, unknown>;
  const parsedProducts = parseProductionOrderProductsInput(source);
  let products: OrderProductRecord[];

  if (parsedProducts && parsedProducts.length > 0) {
    products = parsedProducts;
  } else {
    const productCode = pickRowField(source, ['ma_hang', 'productCode', 'ma_sp'], '');
    const productName = pickRowField(source, ['ten_hang', 'productName', 'ten_sp'], '');
    if (!productCode && !productName) {
      return { error: 'Cần nhập mã hàng hoặc tên hàng.' };
    }

    const quantity = parseOrderQuantity(source.so_luong ?? source.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'Số lượng phải lớn hơn 0.' };
    }

    products = [
      {
        ma_don_hang: pickRowField(source, ['ma_don_hang', 'orderRef', 'order_code'], ''),
        ma_sp: productCode,
        ten_sp: productName,
        don_vi: pickRowField(source, ['don_vi', 'unit'], ''),
        so_luong: quantity
      }
    ];
  }

  const summary = summarizeProductionOrderProducts(products);
  const productOrderRefs = [
    ...new Set(products.map(item => String(item.ma_don_hang ?? '').trim()).filter(Boolean))
  ];
  const orderRef = pickRowField(source, ['ma_don_hang', 'orderRef', 'order_code'], '') || productOrderRefs.join(', ');
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
  const defaultName =
    products.length === 1
      ? products[0].ten_sp
        ? `SX ${products[0].ten_sp}`
        : `Lệnh SX ${code}`
      : products.map(item => item.ten_sp || item.ma_sp).filter(Boolean).join(' + ')
        ? `SX ${products.map(item => item.ten_sp || item.ma_sp).filter(Boolean).join(' + ')}`
        : `Lệnh SX ${code}`;

  return {
    record: {
      ma_lenh_sx: code,
      ten_lenh_sx: name || defaultName,
      ma_hang: summary.productCode,
      ten_hang: summary.productName,
      san_pham: products,
      so_luong: summary.quantity,
      don_vi: summary.unit,
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

function productionPlanWriteErrorMessage(error: { code?: string; message?: string }) {
  if (isMissingTableError(error)) {
    return `Bảng ${SUPABASE_PRODUCTION_PLANS_TABLE} chưa tồn tại. Hãy chạy file supabase-ke-hoach-san-xuat.sql trong Supabase SQL Editor.`;
  }
  if (isMissingColumnError(error)) {
    return `Bảng ${SUPABASE_PRODUCTION_PLANS_TABLE} đang thiếu cột. Hãy chạy file supabase-ke-hoach-san-xuat.sql.`;
  }
  return `Không thể lưu kế hoạch sản xuất vào ${SUPABASE_PRODUCTION_PLANS_TABLE}. ${error.message}`;
}

function parseProductionPlanDateInput(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function makeProductionPlanCode(planDate: string) {
  const compact = planDate.replace(/-/g, '');
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `KHSX-${compact}-${suffix}`;
}

type ProductionPlanSnapshotLine = {
  lenh_sx_id: number | null;
  thu_tu_uu_tien: number;
  vi_tri: string | null;
  ghi_chu: string;
  ma_lenh_sx: string;
  ma_don_hang: string;
  ca: string;
  may: string;
  nhan_su: string;
  san_pham: unknown[];
};

function parseProductionPlanSnapshotLine(raw: unknown): ProductionPlanSnapshotLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const thu_tu_uu_tien = Number(item.thu_tu_uu_tien ?? item.priority);
  if (!Number.isFinite(thu_tu_uu_tien) || thu_tu_uu_tien <= 0) return null;

  const lenhRaw = item.lenh_sx_id ?? item.id;
  const lenhNumeric = Number(lenhRaw);
  const sanPhamRaw = item.san_pham ?? item.products;
  const san_pham = Array.isArray(sanPhamRaw) ? sanPhamRaw : [];

  return {
    lenh_sx_id: Number.isFinite(lenhNumeric) ? lenhNumeric : null,
    thu_tu_uu_tien: Math.round(thu_tu_uu_tien),
    vi_tri:
      typeof item.vi_tri === 'string' && item.vi_tri.trim()
        ? item.vi_tri.trim()
        : typeof item.position === 'string' && item.position.trim()
          ? item.position.trim()
          : null,
    ghi_chu: typeof item.ghi_chu === 'string' ? item.ghi_chu.trim() : typeof item.note === 'string' ? item.note.trim() : '',
    ma_lenh_sx: pickRowField(item, ['ma_lenh_sx', 'code'], ''),
    ma_don_hang: pickRowField(item, ['ma_don_hang', 'orderRef', 'order_code'], ''),
    ca: pickRowField(item, ['ca', 'shift'], ''),
    may: pickRowField(item, ['may', 'machine'], ''),
    nhan_su: pickRowField(item, ['nhan_su', 'staff'], ''),
    san_pham
  };
}

async function saveProductionPlanSnapshot(options: {
  planDate: string;
  note: string;
  createdBy: string;
  lines: ProductionPlanSnapshotLine[];
}) {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình.');
  }

  const header = {
    ma_ke_hoach: makeProductionPlanCode(options.planDate),
    ngay_ke_hoach: options.planDate,
    trang_thai: 'Đã lập',
    so_lenh: options.lines.length,
    ghi_chu: options.note,
    nguoi_lap: options.createdBy,
    updated_at: new Date().toISOString()
  };

  const { data: createdPlan, error: headerError } = await supabase
    .from(SUPABASE_PRODUCTION_PLANS_TABLE)
    .insert(header)
    .select('*')
    .single();

  if (headerError) {
    console.error('Supabase ke_hoach_san_xuat insert error:', headerError);
    throw new Error(productionPlanWriteErrorMessage(headerError));
  }

  const planId = String((createdPlan as Record<string, unknown>).id ?? '');
  if (!planId) {
    throw new Error('Không thể tạo bản ghi kế hoạch sản xuất.');
  }

  const detailRows = options.lines.map(line => ({
    ke_hoach_id: planId,
    lenh_sx_id: line.lenh_sx_id,
    thu_tu_uu_tien: line.thu_tu_uu_tien,
    vi_tri: line.vi_tri,
    ghi_chu: line.ghi_chu,
    ma_lenh_sx: line.ma_lenh_sx,
    ma_don_hang: line.ma_don_hang,
    ca: line.ca,
    may: line.may,
    nhan_su: line.nhan_su,
    san_pham: line.san_pham
  }));

  const { error: detailError } = await supabase.from(SUPABASE_PRODUCTION_PLAN_LINES_TABLE).insert(detailRows);
  if (detailError) {
    console.error('Supabase ke_hoach_san_xuat_dong insert error:', detailError);
    await supabase.from(SUPABASE_PRODUCTION_PLANS_TABLE).delete().eq('id', planId);
    throw new Error(productionPlanWriteErrorMessage(detailError));
  }

  return createdPlan;
}

function splitProductionProductCodes(raw: string): string[] {
  return raw
    .split(',')
    .map(code => code.trim())
    .filter(code => code && code !== '-');
}

async function getRemainingProductionQuantityForProduct(
  orderRef: string,
  productCode: string
): Promise<{ ordered: number; allocated: number; remaining: number }> {
  if (!supabase || !orderRef || !productCode) {
    return { ordered: 0, allocated: 0, remaining: 0 };
  }

  const { data: orderRowsByCode, error: orderRowsError } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select('san_pham')
    .eq('ma_don_hang', orderRef);

  if (orderRowsError) {
    console.error('Supabase don_hang remaining qty error:', orderRowsError);
    throw new Error(`Không thể đọc sản phẩm của đơn ${orderRef}. ${orderRowsError.message}`);
  }

  const ordered = (orderRowsByCode || []).reduce((sum, row) => {
    return sum + getOrderedQuantityFromOrderRow(row as Record<string, unknown>, productCode);
  }, 0);

  const { data: productionRows, error: productionError } = await supabase
    .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
    .select('ma_don_hang, ma_hang, so_luong, san_pham');

  if (productionError) {
    console.error('Supabase lenh_sx remaining qty error:', productionError);
    return { ordered, allocated: 0, remaining: ordered };
  }

  const allocated = (productionRows || []).reduce((sum, row) => {
    const productionRow = row as Record<string, unknown>;
    const rowOrderRefs = String(productionRow.ma_don_hang ?? '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    return (
      sum +
      parseOrderProductsFromRow(productionRow).reduce((innerSum, item) => {
        const itemOrderRef = String(item.ma_don_hang ?? '').trim();
        const matchesOrder = itemOrderRef
          ? itemOrderRef === orderRef
          : rowOrderRefs.length === 0 || rowOrderRefs.includes(orderRef);
        if (!matchesOrder || item.ma_sp !== productCode) return innerSum;
        return innerSum + (item.so_luong ?? 0);
      }, 0)
    );
  }, 0);

  return { ordered, allocated, remaining: Math.max(0, ordered - allocated) };
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

function isBundledAssetPath(urlPath: string) {
  return /^\/assets\/.+\.(?:js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(urlPath);
}

async function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  const PORT = 3002;
  const distPath = path.join(process.cwd(), 'dist');

  if (process.env.NODE_ENV !== 'production') {
    const publicPath = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }

    // Cached production index.html may still request /assets/*.js while dev uses /src/main.tsx.
    // Never serve stale dist bundles in dev — return 404 (not SPA HTML) so the browser shows a clear error.
    app.use((req, res, next) => {
      const urlPath = (req.url || '/').split('?')[0] || '/';
      if (!isBundledAssetPath(urlPath)) {
        next();
        return;
      }

      res
        .status(404)
        .type('text/plain')
        .send(
          'Production asset requested in dev mode. Hard-refresh (Ctrl+Shift+R) — dev loads /src/main.tsx.'
        );
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.join(process.cwd(), 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const urlPath = (req.url || '/').split('?')[0] || '/';
      if (isBundledAssetPath(urlPath)) {
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[FULLSTACK] Server running on http://0.0.0.0:${PORT}`);
    getReportsFromDb();
    void ensureWarehouseSlipNumericColumns();
  });
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.use((req, _res, next) => {
    if (!process.env.VERCEL) {
      next();
      return;
    }

    const rawUrl = req.url || '/';
    const queryIndex = rawUrl.indexOf('?');
    const pathname = queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl;
    const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';

    if (!pathname.startsWith('/api')) {
      req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`;
    }

    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      supabase: Boolean(supabase),
      supabaseUrl: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}...` : null,
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
      hasAnonKey: Boolean(process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY),
      keySource: process.env.SUPABASE_SERVICE_KEY
        ? 'SUPABASE_SERVICE_KEY'
        : process.env.SUPABASE_KEY
          ? 'SUPABASE_KEY'
          : process.env.NEXT_PUBLIC_SUPABASE_KEY
            ? 'NEXT_PUBLIC_SUPABASE_KEY'
            : 'none',
      vercel: Boolean(process.env.VERCEL),
      tables: {
        reports: SUPABASE_TABLE,
        productionPlans: SUPABASE_PRODUCTION_PLANS_TABLE
      }
    });
  });

  // API Route: Get all reports
  app.get('/api/reports', async (_req, res) => {
    try {
      const list = await getReportsFromDb();
      const sorted = [...(list || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return res.json(sorted);
    } catch (err: any) {
      console.error('GET /api/reports error:', err);
      try {
        const fallback = await getReportsFromLocalFile();
        return res.json(fallback);
      } catch (fallbackErr) {
        console.error('GET /api/reports fallback error:', fallbackErr);
        return res.json(getSeedReports());
      }
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
          .from(SUPABASE_TABLE)
          .insert(newReport)
          .select()
          .single();

        if (!error && data) {
          return res.status(201).json(data as ProductionReport);
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
          return respondSupabaseReadError(res, error, SUPABASE_PRODUCTS_TABLE, { products: [], total: 0 });
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

  app.post('/api/san-pham', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsedProduct = parseProductPatchBody(req.body);
      if ('error' in parsedProduct) {
        return res.status(400).json({ error: parsedProduct.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_PRODUCTS_TABLE)
        .insert(parsedProduct.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase san_pham insert error:', error);
        return res.status(500).json({ error: productWriteErrorMessage(error) });
      }

      return res.status(201).json({ success: true, product: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tạo sản phẩm.' });
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
        'code', 'ma_sp', 'newCode', 'ma_sp_moi', 'amisCode', 'ma_amis', 'name', 'ten_sp', 'nature', 'tinh_chat', 'group', 'nhom_vthh',
        'unit', 'don_vi', 'openingStock', 'ton_dau_ky', 'inbound', 'nhap_trong_ky', 'outbound', 'xuat_trong_ky',
        'stock', 'sl_ton', 'minStock', 'so_luong_ton_toi_thieu',
        'origin', 'nguon_goc', 'description', 'mo_ta',
        'totalWeight', 'tong_trong_luong', 'rollWidth', 'kho_cuon', 'rollLength', 'chieu_dai_cuon',
        'coreWeight', 'trong_luong_loi', 'bagWeight', 'trong_luong_tui', 'plasticWeight', 'trong_luong_nhua'
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
        return respondSupabaseReadError(res, error, SUPABASE_MACHINES_TABLE, { machines: [], total: 0 });
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
        return respondSupabaseReadError(res, error, SUPABASE_ORDERS_TABLE, { orders: [], total: 0 });
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
      const source = req.body && typeof req.body === 'object' ? { ...(req.body as Record<string, unknown>) } : {};
      if (!String(source.orderCode ?? '').trim()) {
        source.orderCode = await generateNextOrderCodeFromDb();
      }

      const parsed = parseOrderBody(source, { isCreate: true });
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
        .order('thu_tu_uu_tien', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });

      if (error && isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
          .select('*')
          .order('ma_lenh_sx', { ascending: true }));
      }

      if (error && isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
          .select('*')
          .order('id', { ascending: true }));
      }

      if (error) {
        return respondSupabaseReadError(res, error, SUPABASE_PRODUCTION_ORDERS_TABLE, {
          productionOrders: [],
          total: 0
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
      const orderProducts = parseOrderProductsFromRow(orderRow);
      if (!orderCode) {
        return res.status(400).json({ error: 'Đơn hàng thiếu mã đơn — không thể tạo lệnh SX.' });
      }
      if (orderProducts.length === 0) {
        return res.status(400).json({ error: 'Đơn hàng chưa có sản phẩm — không thể tạo lệnh SX.' });
      }
      if (orderProducts.length > 1) {
        return res.status(400).json({
          error: 'Đơn có nhiều sản phẩm — hãy tạo lệnh SX từ menu Lệnh sản xuất và chọn từng SP.'
        });
      }

      const firstProduct = orderProducts[0];
      if (!firstProduct.ma_sp && !firstProduct.ten_sp) {
        return res.status(400).json({ error: 'Sản phẩm trong đơn thiếu mã SP hoặc tên SP.' });
      }

      let code = makeProductionOrderCode(orderCode);
      code = await ensureUniqueProductionOrderCode(code);

      const record = buildProductionOrderRecordFromOrder(orderRow, code, firstProduct);
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

      const orderRef = String(record.ma_don_hang ?? '').trim();
      const orderProducts = parseOrderProductsFromRow(record);

      for (const product of orderProducts) {
        const productCode = product.ma_sp;
        const requestQuantity = product.so_luong ?? 0;
        const productOrderRef = String(product.ma_don_hang ?? '').trim() || orderRef;
        if (!productOrderRef || !productCode) continue;

        const { ordered, remaining } = await getRemainingProductionQuantityForProduct(productOrderRef, productCode);
        if (ordered <= 0) {
          return res.status(400).json({
            error: `Sản phẩm ${productCode} không có trong đơn ${productOrderRef} hoặc chưa có số lượng đặt hàng.`
          });
        }
        if (remaining <= 0) {
          return res.status(400).json({
            error: `Sản phẩm ${productCode} đã được lập đủ lệnh SX cho đơn ${productOrderRef}.`
          });
        }
        if (requestQuantity > remaining) {
          return res.status(400).json({
            error: `Số lượng vượt quá còn lại (${remaining}) cho ${productCode}.`
          });
        }
      }

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

  app.get('/api/ke-hoach-sx', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.query.id ?? '').trim();
      if (id) {
        const { data: plan, error: planError } = await supabase
          .from(SUPABASE_PRODUCTION_PLANS_TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (planError) {
          console.error('Supabase ke_hoach_san_xuat detail error:', planError);
          return res.status(500).json({ error: productionPlanWriteErrorMessage(planError) });
        }
        if (!plan) {
          return res.status(404).json({ error: 'Không tìm thấy kế hoạch sản xuất.' });
        }

        const { data: lines, error: linesError } = await supabase
          .from(SUPABASE_PRODUCTION_PLAN_LINES_TABLE)
          .select('*')
          .eq('ke_hoach_id', id)
          .order('thu_tu_uu_tien', { ascending: true });

        if (linesError) {
          console.error('Supabase ke_hoach_san_xuat_dong detail error:', linesError);
          return res.status(500).json({ error: productionPlanWriteErrorMessage(linesError) });
        }

        return res.json({ plan, lines: lines || [] });
      }

      let query = supabase
        .from(SUPABASE_PRODUCTION_PLANS_TABLE)
        .select('*')
        .order('ngay_ke_hoach', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(req.query.limit) || 100, 500));

      const planDate = parseProductionPlanDateInput(req.query.ngay ?? req.query.planDate);
      const fromDate = parseProductionPlanDateInput(req.query.tu_ngay ?? req.query.fromDate);
      const toDate = parseProductionPlanDateInput(req.query.den_ngay ?? req.query.toDate);

      if (planDate) {
        query = query.eq('ngay_ke_hoach', planDate);
      } else {
        if (fromDate) query = query.gte('ngay_ke_hoach', fromDate);
        if (toDate) query = query.lte('ngay_ke_hoach', toDate);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Supabase ke_hoach_san_xuat list error:', error);
        return res.status(500).json({ error: productionPlanWriteErrorMessage(error) });
      }

      return res.json({ plans: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải kế hoạch sản xuất.' });
    }
  });

  app.put('/api/ke-hoach-sx', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const source = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const items = source.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Danh sách lệnh SX trống.' });
      }

      const planDate = parseProductionPlanDateInput(source.ngay_ke_hoach ?? source.planDate) ?? todayDateString();
      const planNote = typeof source.ghi_chu === 'string' ? source.ghi_chu.trim() : '';
      const createdBy = pickRowField(source, ['nguoi_lap', 'createdBy', 'staff'], '');

      const updates: Array<{ id: string; vi_tri: string | null; thu_tu_uu_tien: number; ghi_chu: string }> = [];
      const snapshotLines: ProductionPlanSnapshotLine[] = [];
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const id = String(item.id ?? item.lenh_sx_id ?? '').trim();
        const thu_tu_uu_tien = Number(item.thu_tu_uu_tien ?? item.priority);
        if (!id || !Number.isFinite(thu_tu_uu_tien) || thu_tu_uu_tien <= 0) continue;
        updates.push({
          id,
          vi_tri: typeof item.vi_tri === 'string' && item.vi_tri.trim() ? item.vi_tri.trim() : null,
          thu_tu_uu_tien: Math.round(thu_tu_uu_tien),
          ghi_chu: typeof item.ghi_chu === 'string' ? item.ghi_chu.trim() : ''
        });

        const snapshotLine = parseProductionPlanSnapshotLine(item);
        if (snapshotLine) snapshotLines.push(snapshotLine);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Không có lệnh SX hợp lệ để lưu kế hoạch.' });
      }

      for (const item of updates) {
        const { error: updateError } = await supabase
          .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
          .update({
            vi_tri: item.vi_tri,
            thu_tu_uu_tien: item.thu_tu_uu_tien,
            ghi_chu: item.ghi_chu
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('Supabase ke_hoach_sx update error:', updateError);
          if (isMissingColumnError(updateError)) {
            return res.status(500).json({
              error: `Bảng ${SUPABASE_PRODUCTION_ORDERS_TABLE} thiếu cột vi_tri/thu_tu_uu_tien. Hãy chạy file supabase-ke-hoach-sx.sql trong Supabase SQL Editor.`
            });
          }
          return res.status(500).json({ error: productionOrderWriteErrorMessage(updateError) });
        }
      }

      let savedPlan: Record<string, unknown> | null = null;
      try {
        savedPlan = (await saveProductionPlanSnapshot({
          planDate,
          note: planNote,
          createdBy,
          lines: snapshotLines.length > 0 ? snapshotLines : updates.map((item, index) => ({
            lenh_sx_id: Number(item.id),
            thu_tu_uu_tien: item.thu_tu_uu_tien || index + 1,
            vi_tri: item.vi_tri,
            ghi_chu: item.ghi_chu,
            ma_lenh_sx: '',
            ma_don_hang: '',
            ca: '',
            may: item.vi_tri ?? '',
            nhan_su: '',
            san_pham: []
          }))
        })) as Record<string, unknown>;
      } catch (snapshotError: any) {
        return res.status(500).json({ error: snapshotError.message || 'Không thể lưu snapshot kế hoạch sản xuất.' });
      }

      return res.json({
        success: true,
        updated: updates.length,
        plan: savedPlan,
        planId: savedPlan?.id ?? null,
        planCode: savedPlan?.ma_ke_hoach ?? null,
        planDate
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lưu kế hoạch sản xuất.' });
    }
  });

  app.patch('/api/lenh-sx/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase is not configured.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Missing production order ID.' });
      }

      const parsed = parseProductionOrderBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data: updated, error: updateError } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .update(parsed.record)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (updateError) {
        console.error('Supabase lenh_sx update error:', updateError);
        return res.status(500).json({ error: productionOrderWriteErrorMessage(updateError) });
      }

      if (!updated) {
        return res.status(404).json({ error: 'Production order not found.' });
      }

      return res.json({
        success: true,
        productionOrder: updated
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error updating production order.' });
    }
  });

  app.delete('/api/lenh-sx/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase is not configured.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Missing production order ID.' });
      }

      const { data: orderRow, error: fetchError } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .select('id, ma_lenh_sx')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Supabase lenh_sx fetch error:', fetchError);
        return res.status(500).json({ error: `Cannot delete production order. ${fetchError.message}` });
      }

      if (!orderRow) {
        return res.status(404).json({ error: 'Production order not found.' });
      }

      const code = String(orderRow.ma_lenh_sx ?? '').trim();
      const cascade = { planLines: 0, downtimeSlips: 0, orders: 0 };
      const warnings: string[] = [];

      // Xóa dữ liệu liên quan trước; lệnh SX xóa sau cùng để lỗi giữa chừng vẫn thử lại được.
      // Cột lenh_sx_id (schema cũ) kiểu bigint — chỉ lọc khi id là số, tránh lỗi khi lệnh SX dùng UUID.
      const isNumericId = /^\d+$/.test(id);
      if (isNumericId) {
        const { data: planLinesById, error: planLinesByIdError } = await supabase
          .from(SUPABASE_PRODUCTION_PLAN_LINES_TABLE)
          .delete()
          .eq('lenh_sx_id', id)
          .select('id');
        if (planLinesByIdError && !isMissingTableError(planLinesByIdError) && !isMissingColumnError(planLinesByIdError)) {
          console.error('Supabase ke_hoach_san_xuat_dong delete error:', planLinesByIdError);
          warnings.push(`Chưa xóa được dòng kế hoạch SX: ${planLinesByIdError.message}`);
        }
        cascade.planLines += planLinesById?.length || 0;
      }

      if (code) {
        const { data: planLinesByCode, error: planLinesByCodeError } = await supabase
          .from(SUPABASE_PRODUCTION_PLAN_LINES_TABLE)
          .delete()
          .eq('ma_lenh_sx', code)
          .select('id');
        if (planLinesByCodeError && !isMissingTableError(planLinesByCodeError) && !isMissingColumnError(planLinesByCodeError)) {
          console.error('Supabase ke_hoach_san_xuat_dong delete error:', planLinesByCodeError);
          warnings.push(`Chưa xóa được dòng kế hoạch SX theo mã: ${planLinesByCodeError.message}`);
        }
        cascade.planLines += planLinesByCode?.length || 0;

        const { data: downtimeSlips, error: downtimeError } = await supabase
          .from(SUPABASE_MACHINE_DOWNTIME_TABLE)
          .delete()
          .eq('lenh_sx_lien_quan', code)
          .select('id');
        if (downtimeError && !isMissingTableError(downtimeError) && !isMissingColumnError(downtimeError)) {
          console.error('Supabase phieu_bao_dung_may delete error:', downtimeError);
          warnings.push(`Chưa xóa được phiếu báo dừng máy: ${downtimeError.message}`);
        }
        cascade.downtimeSlips += downtimeSlips?.length || 0;

        const { data: linkedOrders, error: ordersError } = await supabase
          .from(SUPABASE_ORDERS_TABLE)
          .delete()
          .eq('lenh_sx', code)
          .select('id');
        if (ordersError && !isMissingTableError(ordersError) && !isMissingColumnError(ordersError)) {
          console.error('Supabase don_hang delete error:', ordersError);
          warnings.push(`Chưa xóa được đơn hàng liên quan: ${ordersError.message}`);
        }
        cascade.orders += linkedOrders?.length || 0;
      }

      const { data, error } = await supabase
        .from(SUPABASE_PRODUCTION_ORDERS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Supabase lenh_sx delete error:', error);
        return res.status(500).json({ error: `Cannot delete production order. ${error.message}` });
      }

      if (!data) {
        return res.status(404).json({ error: 'Production order not found.' });
      }

      return res.json({
        success: true,
        cascade,
        warning: warnings.length > 0 ? warnings.join(' ') : undefined
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error deleting production order.' });
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
        return respondSupabaseReadError(res, error, SUPABASE_SETTINGS_TABLE, { settings: [], total: 0 });
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
        return respondSupabaseReadError(res, error, SUPABASE_MATERIALS_TABLE, { materials: [], total: 0 });
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

  app.post('/api/kho-nvl/fill-total-kg', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const value = parseOptionalMaterialNumber(req.body?.value ?? req.body?.totalWeight ?? 25);
      if (value === null || value <= 0) {
        return res.status(400).json({ error: 'Giá trị Tổng kg không hợp lệ.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .select('ma_npl, don_vi');

      if (error) {
        console.error('Supabase kho_nvl fill-total-kg read error:', error);
        return res.status(500).json({ error: materialWriteErrorMessage(error) });
      }

      const codes = (data || [])
        .filter(row => {
          const code = String(row.ma_npl ?? '').trim();
          return code && isMaterialKgUnitValue(row.don_vi);
        })
        .map(row => String(row.ma_npl).trim());

      if (codes.length === 0) {
        return res.status(400).json({ error: 'Không có NPL nào có đơn vị Kg.' });
      }

      const { error: updateError } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .update({ tong_trong_luong: value })
        .in('ma_npl', codes);

      if (updateError) {
        console.error('Supabase kho_nvl fill-total-kg update error:', updateError);
        return res.status(500).json({ error: materialWriteErrorMessage(updateError) });
      }

      return res.json({
        success: true,
        updated: codes.length,
        value,
        codes
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi điền Tổng kg hàng loạt.' });
    }
  });

  app.patch('/api/kho-nvl/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      const filter = resolveMaterialRowFilter(id);
      if (!filter) {
        return res.status(400).json({ error: 'Thiếu ID nguyên phụ liệu.' });
      }

      const parsed = parseMaterialBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .update(parsed.record)
        .eq(filter.column, filter.value)
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
      const filter = resolveMaterialRowFilter(id);
      if (!filter) {
        return res.status(400).json({ error: 'Thiếu ID nguyên phụ liệu.' });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MATERIALS_TABLE)
        .delete()
        .eq(filter.column, filter.value)
        .select(filter.column)
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
          so_luong_chung_tu: item.documentQuantity ?? null,
          don_gia: item.unitPrice,
          thanh_tien: item.lineAmount,
          ly_do: parsed.lyDo || '',
          ghi_chu: parsed.ghiChu || '',
          nguoi_lap: parsed.nguoiLap || nhanSu,
          nhan_su: nhanSu,
          ca: parsed.ca || ''
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

  app.put('/api/phieu-xuat-nhap-kho/:slipCode', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const slipCode = String(req.params.slipCode || '').trim();
      if (!slipCode) {
        return res.status(400).json({ error: 'Thiếu mã phiếu.' });
      }

      const parsed = parseWarehouseSlipBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data: existing, error: fetchError } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .select('ma_npl, loai_kho')
        .eq('ma_phieu', slipCode);

      if (fetchError) {
        console.error('Supabase phieu_xuat_nhap_kho fetch for update error:', fetchError);
        return res.status(500).json({
          error: `Không thể tải phiếu cần cập nhật từ ${SUPABASE_WAREHOUSE_MOVEMENTS_TABLE}. ${fetchError.message}`
        });
      }

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy phiếu cần cập nhật.' });
      }

      const affectedNvlCodes = new Set<string>();
      existing.forEach(row => {
        const code = String(row.ma_npl || '').trim();
        if (code && String(row.loai_kho || 'nvl') !== 'san_pham') {
          affectedNvlCodes.add(code);
        }
      });
      if (parsed.loaiKho === 'nvl') {
        parsed.items.forEach(item => {
          const code = item.code.trim();
          if (code) affectedNvlCodes.add(code);
        });
      }

      const { error: deleteError } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .delete()
        .eq('ma_phieu', slipCode);

      if (deleteError) {
        console.error('Supabase phieu_xuat_nhap_kho delete for update error:', deleteError);
        return res.status(500).json({ error: `Không thể xóa dữ liệu phiếu cũ. ${deleteError.message}` });
      }

      const nhanSu = parsed.nguoiLap || 'Hệ thống';
      const records = parsed.items.map(item => {
        const base = {
          ma_phieu: slipCode,
          loai_phieu: parsed.loaiPhieu,
          loai_kho: parsed.loaiKho,
          ngay_phieu: parsed.ngayPhieu,
          don_vi: item.unit || '',
          so_luong: item.quantity,
          so_luong_chung_tu: item.documentQuantity ?? null,
          don_gia: item.unitPrice,
          thanh_tien: item.lineAmount,
          ly_do: parsed.lyDo || '',
          ghi_chu: parsed.ghiChu || '',
          nguoi_lap: parsed.nguoiLap || nhanSu,
          nhan_su: nhanSu,
          ca: parsed.ca || ''
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
        console.error('Supabase phieu_xuat_nhap_kho update insert error:', error);
        return res.status(500).json({ error: warehouseSlipWriteErrorMessage(error) });
      }

      if (affectedNvlCodes.size > 0) {
        await Promise.all([...affectedNvlCodes].map(code => syncMaterialInventoryFromMovements(code)));
      }

      return res.json({
        success: true,
        slipCode,
        movements: data || []
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật phiếu xuất nhập kho.' });
    }
  });

  app.delete('/api/phieu-xuat-nhap-kho/slip/:slipCode', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const slipCode = String(req.params.slipCode || '').trim();
      if (!slipCode) {
        return res.status(400).json({ error: 'Thiếu mã phiếu.' });
      }

      const { data: existing, error: fetchError } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .select('id, ma_npl, loai_kho')
        .eq('ma_phieu', slipCode);

      if (fetchError) {
        console.error('Supabase phieu_xuat_nhap_kho fetch for slip delete error:', fetchError);
        return res.status(500).json({ error: `Không thể tải phiếu cần xóa. ${fetchError.message}` });
      }

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy phiếu cần xóa.' });
      }

      const affectedNvlCodes = new Set<string>();
      existing.forEach(row => {
        const code = String(row.ma_npl || '').trim();
        if (code && String(row.loai_kho || 'nvl') !== 'san_pham') {
          affectedNvlCodes.add(code);
        }
      });

      const { error: deleteError } = await supabase
        .from(SUPABASE_WAREHOUSE_MOVEMENTS_TABLE)
        .delete()
        .eq('ma_phieu', slipCode);

      if (deleteError) {
        console.error('Supabase phieu_xuat_nhap_kho slip delete error:', deleteError);
        return res.status(500).json({ error: `Không thể xóa phiếu. ${deleteError.message}` });
      }

      if (affectedNvlCodes.size > 0) {
        await Promise.all([...affectedNvlCodes].map(code => syncMaterialInventoryFromMovements(code)));
      }

      return res.json({ success: true, deletedCount: existing.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa phiếu xuất nhập kho.' });
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
    const format = typeof req.query.format === 'string' ? req.query.format : 'list';

    if (!supabase) {
      if (format === 'groups') {
        return res.json({ branches: [], total: 0, source: 'local' });
      }
      return res.json([]);
    }

    try {
      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'filtered';
      const departmentFilter = `%${SUPABASE_STAFF_DEPARTMENT}%`;
      const branchFilter = `%${SUPABASE_STAFF_BRANCH}%`;

      if (format === 'groups') {
        const { data, error } = await supabase
          .from(SUPABASE_STAFF_TABLE)
          .select('*');

        if (error) {
          return respondSupabaseReadError(res, error, SUPABASE_STAFF_TABLE, { branches: [], total: 0 });
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

  app.post('/api/nhan-su', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const source = req.body && typeof req.body === 'object' ? { ...(req.body as Record<string, unknown>) } : {};
      if (!pickRowField(source, ['ma_nhan_su', 'ma_nv', 'code'], '')) {
        source.ma_nhan_su = await generateNextStaffCodeFromDb();
      }

      const parsed = parseStaffBody(source);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data: created, error: insertError } = await supabase
        .from(SUPABASE_STAFF_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (insertError) {
        console.error('Supabase nhan_su insert error:', insertError);
        return res.status(500).json({ error: staffWriteErrorMessage(insertError) });
      }

      return res.status(201).json({
        success: true,
        staff: created,
        person: mapStaffRecord(created as Record<string, unknown>)
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi thêm nhân sự.' });
    }
  });

  registerWeighingSlipRoutes(app, '/api/phieu-can-dinh-ki', {
    localFilePath: WEIGHING_DB_FILE_PATH,
    supabaseTable: SUPABASE_WEIGHING_TABLE,
    sqlMigrationFile: 'supabase-phieu-can-dinh-ki.sql',
    entityLabel: 'phiếu cân',
    localEntryPrefix: 'pcdk_'
  });

  registerWeighingSlipRoutes(app, '/api/bao-cao-hang-hong', {
    localFilePath: DAMAGED_GOODS_DB_FILE_PATH,
    supabaseTable: SUPABASE_DAMAGED_GOODS_TABLE,
    sqlMigrationFile: 'supabase-bao-cao-hang-hong.sql',
    entityLabel: 'báo cáo hàng hỏng',
    localEntryPrefix: 'bchh_'
  });

  app.get('/api/bao-cao-phoi-tron', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const tuNgay = parseWarehouseSlipDate(req.query.tu_ngay ?? req.query.fromDate);
      const denNgay = parseWarehouseSlipDate(req.query.den_ngay ?? req.query.toDate);
      const ca = typeof req.query.ca === 'string' ? req.query.ca.trim() : '';
      const maMay = typeof req.query.ma_may === 'string' ? req.query.ma_may.trim() : '';

      let query = supabase
        .from(SUPABASE_MIXING_REPORTS_TABLE)
        .select('*')
        .order('ngay', { ascending: false })
        .order('gio', { ascending: false });

      if (ngay) {
        query = query.eq('ngay', ngay);
      } else {
        if (tuNgay) query = query.gte('ngay', tuNgay);
        if (denNgay) query = query.lte('ngay', denNgay);
      }
      if (ca) query = query.eq('ca', ca);
      if (maMay) query = query.eq('ma_may', maMay);

      const { data, error } = await query;
      if (error) {
        console.error('Supabase mixing report query error:', error);
        return res.status(500).json({ error: mixingReportWriteError(error) });
      }

      const reports = (data || []).map(row =>
        row && typeof row === 'object'
          ? {
              ...row,
              lan_thu: extractMixingReportLanThu(row as Record<string, unknown>),
              hinh_anh_theo_lan: extractMixingReportPhotos(row as Record<string, unknown>),
              ly_do_theo_lan: extractMixingReportReasons(row as Record<string, unknown>),
              giai_trinh_theo_lan: extractMixingReportExplanations(row as Record<string, unknown>)
            }
          : row
      );

      return res.json({ reports, total: reports.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải báo cáo phối trộn.' });
    }
  });

  app.get('/api/bao-cao-phoi-tron/ly-do-goi-y', async (_req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const { data, error } = await supabase
        .from(SUPABASE_MIXING_REPORTS_TABLE)
        .select('ly_do_theo_lan, chi_tiet')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        if (isMissingColumnError(error) && String(error.message ?? '').toLowerCase().includes('ly_do_theo_lan')) {
          const fallback = await supabase
            .from(SUPABASE_MIXING_REPORTS_TABLE)
            .select('chi_tiet')
            .order('created_at', { ascending: false })
            .limit(500);
          if (fallback.error) {
            return res.status(500).json({ error: mixingReportWriteError(fallback.error) });
          }
          return res.json({
            reasons: collectMixingReasonSuggestions(
              (fallback.data || []).filter(
                (row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')
              )
            )
          });
        }
        return res.status(500).json({ error: mixingReportWriteError(error) });
      }

      return res.json({
        reasons: collectMixingReasonSuggestions(
          (data || []).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
        )
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Không thể tải gợi ý lý do.' });
    }
  });

  app.post('/api/bao-cao-phoi-tron', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseMixingReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await writeMixingReportRecord(parsed.record, 'insert');

      if (error) {
        console.error('Supabase mixing report insert error:', error);
        return res.status(500).json({ error: mixingReportWriteError(error) });
      }

      return res.status(201).json({
        success: true,
        report: data
          ? {
              ...data,
              lan_thu: extractMixingReportLanThu(data as Record<string, unknown>),
              hinh_anh_theo_lan: extractMixingReportPhotos(data as Record<string, unknown>),
              ly_do_theo_lan: extractMixingReportReasons(data as Record<string, unknown>),
              giai_trinh_theo_lan: extractMixingReportExplanations(data as Record<string, unknown>)
            }
          : data
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lưu báo cáo phối trộn.' });
    }
  });

  app.patch('/api/bao-cao-phoi-tron/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const parsed = parseMixingReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await writeMixingReportRecord(parsed.record, 'update', id);

      if (error) {
        console.error('Supabase mixing report update error:', error);
        return res.status(500).json({ error: mixingReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({
        success: true,
        report: {
          ...data,
          lan_thu: extractMixingReportLanThu(data as Record<string, unknown>),
          hinh_anh_theo_lan: extractMixingReportPhotos(data as Record<string, unknown>),
          ly_do_theo_lan: extractMixingReportReasons(data as Record<string, unknown>),
          giai_trinh_theo_lan: extractMixingReportExplanations(data as Record<string, unknown>)
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật báo cáo phối trộn.' });
    }
  });

  app.delete('/api/bao-cao-phoi-tron/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const { data, error } = await supabase
        .from(SUPABASE_MIXING_REPORTS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .single();

      if (error) {
        console.error('Supabase mixing report delete error:', error);
        return res.status(500).json({ error: mixingReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa báo cáo phối trộn.' });
    }
  });

  app.get('/api/bao-cao-may-nvl-ton', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const maMay = typeof req.query.ma_may === 'string' ? req.query.ma_may.trim() : '';
      const loaiBaoCaoRaw = typeof req.query.loai_bao_cao === 'string' ? req.query.loai_bao_cao.trim() : '';
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 300) : 100;

      let query = supabase
        .from(SUPABASE_MACHINE_NVL_REPORTS_TABLE)
        .select('*')
        .order('ngay', { ascending: false })
        .order('gio', { ascending: false })
        .limit(limit);

      if (ngay) query = query.eq('ngay', ngay);
      if (maMay) query = query.eq('ma_may', maMay);
      if (loaiBaoCaoRaw) query = query.eq('loai_bao_cao', parseMachineNvlReportKind(loaiBaoCaoRaw));

      const { data, error } = await query;
      if (error) {
        console.error('Supabase machine NVL report query error:', error);
        return res.status(500).json({ error: machineNvlReportWriteError(error) });
      }

      return res.json({ reports: data || [], total: data?.length || 0 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải báo cáo NVL tồn theo máy.' });
    }
  });

  app.post('/api/bao-cao-may-nvl-ton', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseMachineNvlReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MACHINE_NVL_REPORTS_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase machine NVL report insert error:', error);
        return res.status(500).json({ error: machineNvlReportWriteError(error) });
      }

      return res.status(201).json({ success: true, report: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lưu báo cáo NVL tồn theo máy.' });
    }
  });

  app.put('/api/bao-cao-may-nvl-ton/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const parsed = parseMachineNvlReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MACHINE_NVL_REPORTS_TABLE)
        .update(parsed.record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase machine NVL report update error:', error);
        return res.status(500).json({ error: machineNvlReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({ success: true, report: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật báo cáo NVL tồn theo máy.' });
    }
  });

  app.delete('/api/bao-cao-may-nvl-ton/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const { data, error } = await supabase
        .from(SUPABASE_MACHINE_NVL_REPORTS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .single();

      if (error) {
        console.error('Supabase machine NVL report delete error:', error);
        return res.status(500).json({ error: machineNvlReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa báo cáo NVL tồn theo máy.' });
    }
  });

  app.get('/api/phieu-bao-dung-may', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const maMay = typeof req.query.ma_may === 'string' ? req.query.ma_may.trim() : '';
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 300) : 100;

      let query = supabase
        .from(SUPABASE_MACHINE_DOWNTIME_TABLE)
        .select('*')
        .order('ngay', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (ngay) query = query.eq('ngay', ngay);
      if (maMay) query = query.eq('ma_may', maMay);

      const { data, error } = await query;
      if (error) {
        console.error('Supabase machine downtime query error:', error);
        return res.status(500).json({ error: machineDowntimeWriteError(error) });
      }

      return res.json({ slips: data || [], total: data?.length || 0 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải phiếu báo dừng máy.' });
    }
  });

  app.post('/api/phieu-bao-dung-may', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseMachineDowntimeBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_MACHINE_DOWNTIME_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase machine downtime insert error:', error);
        return res.status(500).json({ error: machineDowntimeWriteError(error) });
      }

      return res.status(201).json({ success: true, slip: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lưu phiếu báo dừng máy.' });
    }
  });

  app.delete('/api/phieu-bao-dung-may/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID phiếu.' });

      const { data, error } = await supabase
        .from(SUPABASE_MACHINE_DOWNTIME_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .single();

      if (error) {
        console.error('Supabase machine downtime delete error:', error);
        return res.status(500).json({ error: machineDowntimeWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy phiếu.' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa phiếu báo dừng máy.' });
    }
  });

  app.post('/api/cloudinary/upload', async (req, res) => {
    try {
      const { imageDataUrl, folder } = req.body;
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        return res.status(400).json({ error: 'Thiếu dữ liệu ảnh.' });
      }

      const uploadFolder =
        typeof folder === 'string' && folder.trim() ? folder.trim() : 'phieu_can_dinh_ki';
      const result = await uploadImageToCloudinary(imageDataUrl, uploadFolder);
      return res.status(201).json(result);
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      res.status(500).json({ error: err.message || 'Không thể upload ảnh.' });
    }
  });

  app.get('/api/bao-cao-nghiem-thu', async (req, res) => {
    if (!supabase) {
      return res.json({ reports: [], total: 0, source: 'local' });
    }

    try {
      const ngay = typeof req.query.ngay === 'string' ? req.query.ngay.trim() : '';
      const tuNgay = parseWarehouseSlipDate(req.query.tu_ngay ?? req.query.fromDate);
      const denNgay = parseWarehouseSlipDate(req.query.den_ngay ?? req.query.toDate);
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 0;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 0;

      let query = supabase
        .from(SUPABASE_ACCEPTANCE_REPORTS_TABLE)
        .select('*')
        .order('ngay', { ascending: false })
        .order('gio', { ascending: false });

      if (ngay) {
        query = query.eq('ngay', ngay);
      } else {
        if (tuNgay) query = query.gte('ngay', tuNgay);
        if (denNgay) query = query.lte('ngay', denNgay);
      }
      if (limit && !ngay && !tuNgay && !denNgay) query = query.limit(limit);

      const { data, error } = await query;
      if (error) {
        return respondSupabaseReadError(res, error, SUPABASE_ACCEPTANCE_REPORTS_TABLE, { reports: [], total: 0 });
      }

      return res.json({ reports: data || [], total: data?.length || 0 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi tải báo cáo sản lượng.' });
    }
  });

  app.post('/api/bao-cao-nghiem-thu', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const parsed = parseAcceptanceReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_ACCEPTANCE_REPORTS_TABLE)
        .insert(parsed.record)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase acceptance report insert error:', error);
        return res.status(500).json({ error: acceptanceReportWriteError(error) });
      }

      return res.status(201).json({ success: true, report: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi lưu báo cáo sản lượng.' });
    }
  });

  app.patch('/api/bao-cao-nghiem-thu/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const parsed = parseAcceptanceReportBody(req.body);
      if ('error' in parsed) {
        return res.status(400).json({ error: parsed.error });
      }

      const { data, error } = await supabase
        .from(SUPABASE_ACCEPTANCE_REPORTS_TABLE)
        .update(parsed.record)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase acceptance report update error:', error);
        return res.status(500).json({ error: acceptanceReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({ success: true, report: data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi cập nhật báo cáo sản lượng.' });
    }
  });

  app.delete('/api/bao-cao-nghiem-thu/:id', async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Thiếu ID báo cáo.' });

      const { data, error } = await supabase
        .from(SUPABASE_ACCEPTANCE_REPORTS_TABLE)
        .delete()
        .eq('id', id)
        .select('id')
        .single();

      if (error) {
        console.error('Supabase acceptance report delete error:', error);
        return res.status(500).json({ error: acceptanceReportWriteError(error) });
      }

      if (!data) return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi xóa báo cáo sản lượng.' });
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
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[API] Unhandled error:', err);
    if (!res.headersSent) {
      const message = err instanceof Error ? err.message : 'Lỗi server API.';
      res.status(500).json({ error: message });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'API route không tồn tại. Hãy chạy npm run dev để khởi động lại server.'
    });
  });

  return app;
}

if (!process.env.VERCEL) {
  startServer();
}
