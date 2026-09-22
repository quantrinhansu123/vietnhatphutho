export type ShiftSetting = {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  timeFrame: string;
  startTime: string;
  endTime: string;
  /** Nhom chung (cot `nhom`) — loc hien thi, KHONG dung de giai chuoi ca. */
  group?: string;
  /** Loai ca san xuat (cot `loai_ca`): 'Ca8H' (HC1 -> HC2 -> HC3) / 'Ca12H' (12C1 -> 12C2). */
  loaiCa?: string;
  /** Thu tu ca trong nhom — cot `thu_tu`. null/undefined = chua xep (cuoi nhom). */
  thuTu?: number | null;
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

function pickThuTu(record: Record<string, unknown>): number | null {
  const raw = record.thu_tu ?? record.thuTu ?? record.thu_tu_ca;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  // DB chua migrate cot thu_tu: thu doc tu ghi_chu JSON { thu_tu: n }.
  const noteRaw = record.ghi_chu ?? record.note ?? record.mo_ta;
  if (typeof noteRaw === 'string' && noteRaw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(noteRaw) as Record<string, unknown>;
      const nested = parsed.thu_tu ?? parsed.thuTu;
      if (typeof nested === 'number' && Number.isFinite(nested)) return Math.trunc(nested);
    } catch {
      /* ghi_chu khong phai JSON — bo qua */
    }
  }
  return null;
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
        endTime: endTime === '-' ? '' : endTime,
        group: pickText(record, ['nhom', 'group', 'phan_loai'], ''),
        loaiCa: pickText(record, ['loai_ca', 'loaiCa'], ''),
        thuTu: pickThuTu(record)
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

  // Cài đặt là nguồn duy nhất cho trường Ca trên toàn hệ thống.
  // Không tự sinh ca cố định vì sẽ làm form lệch với trang /cai-dat.
  return [];
}

export function shiftNamesMatch(left: string, right: string, shiftOptions?: ShiftOption[]) {
  const rawLeft = String(left ?? '').trim();
  const rawRight = String(right ?? '').trim();
  if (!rawLeft || !rawRight) return false;

  if (shiftOptions && shiftOptions.length > 0) {
    const normalizedLeft = resolveShiftName(rawLeft, shiftOptions).toLowerCase();
    const normalizedRight = resolveShiftName(rawRight, shiftOptions).toLowerCase();
    if (normalizedLeft === normalizedRight) return true;
  }

  const a = rawLeft.toLowerCase();
  const b = rawRight.toLowerCase();
  if (a === b) return true;

  const parsedLeft = parseProductionCShift(rawLeft);
  const parsedRight = parseProductionCShift(rawRight);
  if (parsedLeft && parsedRight) {
    if (parsedLeft.num !== parsedRight.num) return false;
    // C2 trên phiếu = 12C2 khi cùng số ca (một bên thiếu prefix 12).
    if (!parsedLeft.family || !parsedRight.family) return true;
    return parsedLeft.family === parsedRight.family;
  }
  // Một bên là 12C2, bên kia là C2 / HC… — không coi là cùng ca.
  if (parsedLeft || parsedRight) return false;

  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return false;
  return a.includes(b) || b.includes(a);
}

/** Chuan hoa khoa so sanh ten ca (khong phan biet hoa thuong / gach noi / khoang trang). */
function normShiftKey(value: string) {
  return String(value || '').trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveShiftName(rawName: string, options: ShiftOption[]): string {
  const trimmed = String(rawName ?? '').trim();
  if (!trimmed || options.length === 0) return trimmed;
  const target = normShiftKey(trimmed);

  // 1) Khop CHINH XAC theo value/label truoc — tranh ca "HC" (chua xep loai ca,
  // dung truoc trong danh sach) nuot "HC1/HC2/HC3" qua `includes`.
  for (const option of options) {
    if (normShiftKey(option.value) === target || normShiftKey(option.label) === target) {
      return option.value;
    }
  }

  // 2) Fallback khop chuoi-con cho ten ca ghi tay — chon option cu the nhat (dai nhat).
  let best: ShiftOption | null = null;
  let bestLen = -1;
  for (const option of options) {
    if (shiftNamesMatch(trimmed, option.value) || shiftNamesMatch(trimmed, option.label)) {
      const len = Math.max(normShiftKey(option.value).length, normShiftKey(option.label).length);
      if (len > bestLen) {
        best = option;
        bestLen = len;
      }
    }
  }
  if (best) return best.value;

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

function shiftOptionIndex(rawShift: string, options: ShiftOption[]): number {
  if (!rawShift.trim() || options.length === 0) return -1;
  const resolved = resolveShiftName(rawShift, options);
  const exact = options.findIndex(
    option =>
      option.value === resolved ||
      shiftNamesMatch(rawShift, option.value) ||
      shiftNamesMatch(resolved, option.value) ||
      shiftNamesMatch(rawShift, option.label)
  );
  if (exact >= 0) return exact;

  const extractRank = (value: string) => {
    const parsed = parseProductionCShift(value);
    if (parsed) return parsed.num;
    return null;
  };
  const currentRank = extractRank(rawShift);
  if (currentRank === null) return -1;
  return options.findIndex(
    option => extractRank(option.value) === currentRank || extractRank(option.label) === currentRank
  );
}

export function shiftIsoDateByDays(isoDate: string, deltaDays: number): string | null {
  const match = String(isoDate || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Parse ca dạng 12C1 / C2 / Ca 12C1.
 * Không nhận HC1/HC2 (chữ cái đứng ngay trước C).
 */
export function parseProductionCShift(value: string): { family: string; num: number } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const re = /(\d*)\s*[cC]\s*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const idx = match.index ?? 0;
    if (idx > 0 && /[A-Za-zÀ-ỹ]/.test(raw.charAt(idx - 1))) continue;
    const num = Number(match[2]);
    if (!Number.isFinite(num)) continue;
    return { family: match[1] || '', num };
  }
  return null;
}

/**
 * Ca trước của ca hiện tại:
 * - Cùng ngày: 12C1 là ca trước của 12C2
 * - Qua ngày: 12C2 ngày hôm trước là ca trước của 12C1 hôm nay
 * - Ca HC / ca thường: theo thứ tự danh sách ca (ca đầu ngày → ca cuối ngày hôm trước)
 */
export function resolvePreviousProductionShift(
  ngay: string,
  shift: string,
  options: ShiftOption[]
): { ngay: string; shift: string } | null {
  const date = String(ngay || '').trim();
  const rawShift = String(shift || '').trim();
  if (!date || !rawShift) return null;

  const current = parseProductionCShift(rawShift);
  if (current && Number.isFinite(current.num)) {
    const resolveInOptions = (family: string, num: number, fallback: string) => {
      const matched = options.find(option => {
        const parsed = parseProductionCShift(option.value) || parseProductionCShift(option.label);
        return parsed && parsed.family === family && parsed.num === num;
      });
      return matched?.value || fallback;
    };

    // 12C2 -> 12C1 cung ngay
    if (current.num > 1) {
      const fallback = rawShift.replace(/([cC]\s*)\d+/, `$1${current.num - 1}`);
      return {
        ngay: date,
        shift: resolveInOptions(current.family, current.num - 1, fallback)
      };
    }

    // 12C1 hom nay -> 12C2 (hoac C lon nhat cung ho) cua ngay hom truoc
    const prevDate = shiftIsoDateByDays(date, -1);
    if (!prevDate) return null;

    let maxNum = 2;
    for (const option of options) {
      const parsed = parseProductionCShift(option.value) || parseProductionCShift(option.label);
      if (!parsed || parsed.family !== current.family) continue;
      if (parsed.num > maxNum) maxNum = parsed.num;
    }
    const fallback = rawShift.replace(/([cC]\s*)\d+/, `$1${maxNum}`);
    return {
      ngay: prevDate,
      shift: resolveInOptions(current.family, maxNum, fallback)
    };
  }

  if (options.length > 0) {
    const idx = shiftOptionIndex(rawShift, options);
    if (idx > 0) {
      return { ngay: date, shift: options[idx - 1].value };
    }
    if (idx === 0) {
      const prevDate = shiftIsoDateByDays(date, -1);
      if (!prevDate) return null;
      return { ngay: prevDate, shift: options[options.length - 1].value };
    }
  }

  return null;
}

/** O ca trong chuoi (Loai ca Ca8H/Ca12H) — value chuan trong ShiftOption + thu tu. */
export interface ShiftChainMeta {
  value: string;
  label: string;
  group: string;
  order: number;
}

/** Tim setting khop CHINH XAC theo ten/ma (khong chuoi-con). */
function findSettingExact(value: string, settings: ShiftSetting[]): ShiftSetting | null {
  const target = normShiftKey(value);
  if (!target) return null;
  for (const setting of settings) {
    if (normShiftKey(setting.name) === target || normShiftKey(setting.code) === target) return setting;
  }
  return null;
}

function findSettingForOptionValue(value: string, settings: ShiftSetting[]): ShiftSetting | null {
  // Uu tien khop chinh xac — tranh option "HC" (chua xep loai ca) bi gan nham
  // vao setting "HC1" roi chen phantom {HC} vao dau chuoi Ca8H.
  const exact = findSettingExact(value, settings);
  if (exact) return exact;
  // Fallback khop chuoi-con cho du lieu cu ghi tay — chon setting cu the nhat (key dai nhat).
  const target = normShiftKey(value);
  if (!target) return null;
  let best: ShiftSetting | null = null;
  let bestLen = -1;
  for (const setting of settings) {
    for (const key of [normShiftKey(setting.name), normShiftKey(setting.code)]) {
      if (!key) continue;
      if (key === target || target.includes(key) || key.includes(target)) {
        if (key.length > bestLen) {
          best = setting;
          bestLen = key.length;
        }
      }
    }
  }
  return best;
}

/**
 * Dung chuoi ca theo (loai_ca, thu_tu): loai ca -> danh sach ca theo thu tu tang dan.
 * Chi gom option co loai ca — ca chua xep loai khong thuoc chuoi nao.
 */
export function buildShiftChains(
  options: ShiftOption[],
  settings: ShiftSetting[]
): Map<string, ShiftChainMeta[]> {
  const chains = new Map<string, ShiftChainMeta[]>();
  for (const option of options) {
    const setting = findSettingForOptionValue(option.value, settings);
    const group = (setting?.loaiCa || '').trim();
    if (!group) continue;
    const order = setting?.thuTu ?? null;
    const list = chains.get(group) || [];
    list.push({
      value: option.value,
      label: option.label,
      group,
      order: order === null ? Number.MAX_SAFE_INTEGER : order
    });
    chains.set(group, list);
  }
  for (const list of chains.values()) {
    list.sort((a, b) => a.order - b.order || a.value.localeCompare(b.value, 'vi'));
  }
  return chains;
}

/** Tim meta chuoi cua 1 ten ca (khop ca lich su ghi tu do ve value chuan). */
export function findShiftChainMeta(
  rawShift: string,
  options: ShiftOption[],
  settings: ShiftSetting[]
): { meta: ShiftChainMeta; list: ShiftChainMeta[]; index: number } | null {
  const trimmed = String(rawShift || '').trim();
  if (!trimmed || options.length === 0) return null;
  const canonical = resolveShiftName(trimmed, options);
  // Ca xac dinh chinh xac duoc nhung CHUA xep Loai ca (vd "HC") => khong thuoc chuoi nao.
  // Tra null de so-tron dung fallback phieu gan nhat (tranh "HC" rot vao chuoi Ca8H cua HC1).
  const owned = findSettingExact(canonical, settings) ?? findSettingExact(trimmed, settings);
  if (owned && !normShiftKey(owned.loaiCa)) return null;
  const chains = buildShiftChains(options, settings);
  const canonKey = normShiftKey(canonical);
  const rawKey = normShiftKey(trimmed);
  // Pass 1: khop chinh xac trong chuoi.
  for (const list of chains.values()) {
    const index = list.findIndex(
      item =>
        normShiftKey(item.value) === canonKey ||
        normShiftKey(item.label) === canonKey ||
        normShiftKey(item.value) === rawKey ||
        normShiftKey(item.label) === rawKey
    );
    if (index >= 0) return { meta: list[index], list, index };
  }
  // Pass 2: khop chuoi-con (du lieu cu ghi tay, vd "Ca HC2").
  for (const list of chains.values()) {
    const index = list.findIndex(
      item =>
        shiftNamesMatch(trimmed, item.value) ||
        shiftNamesMatch(trimmed, item.label)
    );
    if (index >= 0) return { meta: list[index], list, index };
  }
  return null;
}

export interface ShiftChainSlot {
  ngay: string;
  shift: string;
}

/**
 * O ca truoc ve mat LOGIC theo vong lap loai ca (khong kiem tra phieu co ton tai):
 * - Ca giua/cuoi loai (N) -> ca thu_tu - 1 cung ngay N.
 * - Ca dau loai (N) -> ca cuoi cung loai ngay N-1 (ca dem tinh theo NGAY BAT DAU).
 * Tra null khi ca hien tai khong thuoc chuoi nao (chua xep Loai ca / thu tu).
 */
export function resolveLogicalPreviousShiftSlot(
  ngay: string,
  shift: string,
  options: ShiftOption[],
  settings: ShiftSetting[]
): ShiftChainSlot | null {
  const date = String(ngay || '').trim();
  if (!date) return null;
  const found = findShiftChainMeta(shift, options, settings);
  if (!found) return null;
  const { list, index } = found;
  if (index > 0) {
    return { ngay: date, shift: list[index - 1].value };
  }
  const prevDate = shiftIsoDateByDays(date, -1);
  if (!prevDate) return null;
  return { ngay: prevDate, shift: list[list.length - 1].value };
}

/**
 * O ca sau ve mat LOGIC theo vong lap loai ca (doi xung voi ca truoc):
 * - Ca dau/giua loai (N) -> ca thu_tu + 1 cung ngay N.
 * - Ca cuoi loai (N) -> ca dau tien loai ngay N+1 (ca dem tinh theo NGAY BAT DAU).
 * Tra null khi ca hien tai khong thuoc chuoi nao (chua xep Loai ca / thu tu).
 */
export function resolveLogicalNextShiftSlot(
  ngay: string,
  shift: string,
  options: ShiftOption[],
  settings: ShiftSetting[]
): ShiftChainSlot | null {
  const date = String(ngay || '').trim();
  if (!date) return null;
  const found = findShiftChainMeta(shift, options, settings);
  if (!found) return null;
  const { list, index } = found;
  if (index < list.length - 1) {
    return { ngay: date, shift: list[index + 1].value };
  }
  const nextDate = shiftIsoDateByDays(date, 1);
  if (!nextDate) return null;
  return { ngay: nextDate, shift: list[0].value };
}

/**
 * Ca truoc / ca sau cua 1 ca trong chuoi (khong can ngay — dung cho man hinh cai-dat):
 * tra ve ten ca truoc/sau + co qua ngay hay khong (wrap dau/cuoi chuoi).
 * - index > 0: ca truoc cung ngay; index == 0: ca truoc la ca cuoi loai (hom truoc).
 * - index < len-1: ca sau cung ngay; index == len-1: ca sau la ca dau loai (hom sau).
 */
export function getChainPrevNextForValue(
  rawShift: string,
  options: ShiftOption[],
  settings: ShiftSetting[]
): { prev: ShiftChainMeta; next: ShiftChainMeta; list: ShiftChainMeta[]; index: number; wrapPrev: boolean; wrapNext: boolean } | null {
  const found = findShiftChainMeta(rawShift, options, settings);
  if (!found) return null;
  const { list, index } = found;
  if (list.length === 0) return null;
  const prevIndex = (index - 1 + list.length) % list.length;
  const nextIndex = (index + 1) % list.length;
  return {
    prev: list[prevIndex],
    next: list[nextIndex],
    list,
    index,
    wrapPrev: index === 0,
    wrapNext: index === list.length - 1
  };
}
