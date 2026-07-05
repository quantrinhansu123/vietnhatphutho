import type { ProductionReport } from '../../types';

export const STORAGE_DRAFT_KEY = 'factory_report_draft_v1';
export const STORAGE_OFFLINE_KEY = 'factory_reports_offline_queue';
export const STORAGE_REPORTS_CACHE_KEY = 'factory_reports_cache_v1';
export const STORAGE_WAREHOUSE_SLIP_DRAFT_KEY = 'warehouse_slip_prefill_draft_v1';
export function readCachedReports(): ProductionReport[] {
  try {
    const cached = localStorage.getItem(STORAGE_REPORTS_CACHE_KEY);
    return cached ? JSON.parse(cached) as ProductionReport[] : [];
  } catch {
    return [];
  }
}
