export type ProductActor = { id: string; username: string; name: string };

/** Đọc cả header cũ và header mã hóa để giữ nguyên tên tiếng Việt trong audit log. */
export function readProductActor(req: { headers?: Record<string, unknown> }): ProductActor {
  const headers = req.headers || {};
  const encoded = headers['x-actor-encoding'] === 'uri-component';
  const pick = (key: string) => {
    const raw = headers[key];
    const value = String((Array.isArray(raw) ? raw[0] : raw) ?? '').trim();
    if (encoded) {
      try {
        return decodeURIComponent(value);
      } catch {
        // Header lỗi định dạng không được làm hỏng thao tác sản phẩm.
      }
    }
    return value;
  };
  const id = pick('x-actor-id');
  const username = pick('x-actor-username');
  const name = pick('x-actor-name');
  return {
    id,
    username: username || id || 'unknown',
    name: name || username || id || 'Không rõ'
  };
}
