import type { ProductionReport } from '../../types';
import { STORAGE_REPORTS_CACHE_KEY } from './storageKeys';

export {
  STORAGE_DRAFT_KEY,
  STORAGE_OFFLINE_KEY,
  STORAGE_REPORTS_CACHE_KEY,
  STORAGE_WAREHOUSE_SLIP_DRAFT_KEY,
  STORAGE_AUTH_KEY
} from './storageKeys';

export function readCachedReports(): ProductionReport[] {
  try {
    const cached = localStorage.getItem(STORAGE_REPORTS_CACHE_KEY);
    return cached ? JSON.parse(cached) as ProductionReport[] : [];
  } catch {
    return [];
  }
}
