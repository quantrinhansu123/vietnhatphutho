export function formatCell(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '' ? '-' : String(value);
}

export function formatTimeCell(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value).trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function pickText(record: Record<string, unknown>, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

/** Dòng tồn kho NVL theo kỳ (Tồn đầu / Nhập / Xuất) — dùng để ẩn dòng trùng 0 ở view gộp. */
export type PeriodActivityRow = {
  code: string;
  openingStock: string;
  inbound: string;
  outbound: string;
};

/**
 * Parse số lượng tồn kho NVL (Tồn đầu / Nhập / Xuất) — chịu được phân tách
 * nghìn kiểu EN (`1,234.5`) lẫn VN (`1.234,5`), thập phân `,` hoặc `.`.
 * Dấu phân tách cuối cùng là thập phân, các dấu trước là nghìn.
 */
export function parsePeriodQuantityValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let text = String(value).trim().replace(/[\s\u00A0\u202F]/g, '');
  if (!text || text === '-' || text === '—' || text === '--') return null;
  if (/[^0-9,.\-]/.test(text)) return null;
  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, '');
    } else {
      const parts = text.split(',');
      if (parts.length > 2) {
        const dec = parts.pop() ?? '';
        text = `${parts.join('')}.${dec}`;
      } else {
        text = text.replace(',', '.');
      }
    }
  } else if (hasDot) {
    const dotCount = (text.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
      else return null;
    }
  }
  if (text === '' || text === '-' || text === '.' || text === '-.') return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function periodActivityValue(value: unknown): number | null {
  return parsePeriodQuantityValue(value);
}

function periodCodeKey(code: string) {
  return String(code || '').trim().replace(/\s+/g, '').toUpperCase();
}

/**
 * View gộp Kho NVL (Toàn bộ / đúng "Kho NVL") liệt kê tách riêng từng kho nên cùng mã
 * hiện nhiều dòng. Ẩn dòng Tồn đầu = Nhập = Xuất = 0 khi cùng mã đã có dòng khác phát
 * sinh — VD nhập vào Kho NVL Phụ thì dòng master cũ Kho NVL 0/0/0 không còn gây nhiễu.
 * Chỉ ẩn khi chắc chắn toàn 0 (ô '—'/không số thì giữ lại); dòng 0 duy nhất của mã vẫn giữ.
 */
export function filterDuplicateZeroWarehouseRows<T extends PeriodActivityRow>(rows: T[]): T[] {
  const activeCodes = new Set<string>();
  for (const row of rows) {
    const key = periodCodeKey(row.code);
    if (!key) continue;
    const active = [row.openingStock, row.inbound, row.outbound].some(value => {
      const num = periodActivityValue(value);
      return num !== null && num !== 0;
    });
    if (active) activeCodes.add(key);
  }
  if (activeCodes.size === 0) return rows;
  return rows.filter(row => {
    const key = periodCodeKey(row.code);
    if (!key || !activeCodes.has(key)) return true;
    const values = [row.openingStock, row.inbound, row.outbound].map(periodActivityValue);
    // Thiếu số (chưa chọn kỳ) thì giữ lại, không ẩn.
    if (values.some(value => value === null)) return true;
    return (values[0] || 0) !== 0 || (values[1] || 0) !== 0 || (values[2] || 0) !== 0;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function fileToOptimizedImageDataUrl(
  file: File,
  options?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const rawDataUrl = await fileToDataUrl(file);
  const maxEdge = options?.maxEdge ?? 1400;
  const quality = options?.quality ?? 0.78;

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const longestEdge = Math.max(image.naturalWidth, image.naturalHeight) || 1;
        const scale = Math.min(1, maxEdge / longestEdge);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(rawDataUrl);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Không thể đọc ảnh để tối ưu.'));
    image.src = rawDataUrl;
  });
}

export function cloudinaryPreviewUrl(url: string, width = 480) {
  const trimmed = String(url || '').trim();
  if (!trimmed || !/res\.cloudinary\.com/i.test(trimmed) || !trimmed.includes('/image/upload/')) {
    return trimmed;
  }
  return trimmed.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${Math.max(64, Math.round(width))},c_limit/`);
}

export async function uploadImage(imageDataUrl: string, folder?: string) {
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, folder })
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Không thể upload ảnh.');
  }

  return {
    imageUrl: String(data.url ?? data.imageUrl ?? ''),
    imagePublicId: String(data.publicId ?? data.imagePublicId ?? '')
  };
}
