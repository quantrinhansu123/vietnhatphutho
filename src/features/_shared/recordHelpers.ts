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

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(imageDataUrl: string) {
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl })
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
