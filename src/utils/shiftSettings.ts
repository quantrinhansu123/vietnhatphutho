import { STANDARD_SHIFTS } from '../types';

export type ShiftSetting = {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  timeFrame: string;
  startTime: string;
  endTime: string;
};

export type ShiftOption = {
  value: string;
  label: string;
};

function pickText(record: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() && String(value).trim() !== '-') {
      return String(value).trim();
    }
  }
  return fallback;
}

function formatTimeCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const raw = String(value).trim();
  if (!raw || raw === '-') return '-';
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

export function normalizeShiftSettings(data: unknown): ShiftSetting[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { settings?: unknown })?.settings)
      ? (data as { settings: unknown[] }).settings
      : [];

  return rows
    .map((item): ShiftSetting | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_cai_dat', 'ma', 'code']);
      const name = pickText(record, ['ten_cai_dat', 'hang_muc', 'name']);
      const startTime = formatTimeCell(
        record.gio_bat_dau ?? record.thoi_gian_bat_dau ?? record.start_time ?? record.gio_bd
      );
      const endTime = formatTimeCell(
        record.gio_ket_thuc ?? record.thoi_gian_ket_thuc ?? record.end_time ?? record.gio_kt
      );
      if (!code && !name) return null;

      return {
        id: pickText(record, ['id'], code || name),
        code: code || name,
        name: name || code,
        loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
        timeFrame: pickText(record, ['khung_gio'], '-'),
        startTime: startTime === '-' ? '' : startTime,
        endTime: endTime === '-' ? '' : endTime
      };
    })
    .filter((setting): setting is ShiftSetting => Boolean(setting));
}

export function getShiftTimeRange(setting: ShiftSetting) {
  if (setting.timeFrame && setting.timeFrame !== '-') return setting.timeFrame;
  if (setting.startTime && setting.endTime) return `${setting.startTime} - ${setting.endTime}`;
  return '';
}

export function formatShiftSettingLabel(setting: ShiftSetting) {
  const base = setting.name || setting.code;
  const timeRange = getShiftTimeRange(setting);
  if (!timeRange) return base;
  if (base.includes(timeRange) || /\(\s*\d{1,2}:\d{2}/.test(base)) return base;
  return `${base} (${timeRange})`;
}

export function getProductionShiftOptions(settings: ShiftSetting[]): ShiftOption[] {
  const fromTimeSettings = settings
    .filter(setting => setting.loaiCaiDat === 'Thời gian')
    .map(setting => ({
      value: setting.name || setting.code,
      label: formatShiftSettingLabel(setting)
    }))
    .filter((option, index, arr) => option.value && arr.findIndex(item => item.value === option.value) === index);

  if (fromTimeSettings.length > 0) return fromTimeSettings;

  const fallbackFromSettings = settings
    .filter(
      setting =>
        setting.loaiCaiDat === 'Sản xuất' || /ca/i.test(setting.name) || /ca/i.test(setting.code)
    )
    .map(setting => ({
      value: setting.name || setting.code,
      label: formatShiftSettingLabel(setting)
    }))
    .filter((option, index, arr) => option.value && arr.findIndex(item => item.value === option.value) === index);

  if (fallbackFromSettings.length > 0) return fallbackFromSettings;

  return STANDARD_SHIFTS.map(shift => ({ value: shift, label: shift }));
}

export function shiftNamesMatch(left: string, right: string) {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function resolveShiftName(rawName: string, options: ShiftOption[]): string {
  const trimmed = rawName.trim();
  if (!trimmed || options.length === 0) return trimmed;

  for (const option of options) {
    if (trimmed === option.value || shiftNamesMatch(trimmed, option.value)) {
      return option.value;
    }
    if (shiftNamesMatch(trimmed, option.label)) {
      return option.value;
    }
  }

  const lower = trimmed.toLowerCase();
  const legacyIndex =
    lower.includes('sáng') || lower.includes('sang')
      ? 0
      : lower.includes('chiều') || lower.includes('chieu')
        ? 1
        : lower.includes('tối') || lower.includes('toi')
          ? 2
          : -1;

  if (legacyIndex >= 0 && legacyIndex < options.length) {
    return options[legacyIndex].value;
  }

  return trimmed;
}
