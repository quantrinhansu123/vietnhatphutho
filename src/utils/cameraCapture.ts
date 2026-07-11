/** Thuộc tính input file chỉ mở camera (không chọn từ thư viện trên mobile). */
export const CAMERA_IMAGE_INPUT_PROPS = {
  type: 'file' as const,
  accept: 'image/*',
  capture: 'environment' as const,
};

export function configureCameraImageInput(input: HTMLInputElement, multiple = false): void {
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'environment');
  input.multiple = multiple;
}

/** Mở camera chụp ảnh (một ảnh mỗi lần). */
export function openCameraImagePicker(onPick: (file: File) => void): void {
  const input = document.createElement('input');
  configureCameraImageInput(input, false);
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) onPick(file);
      // Trì hoãn remove để một số trình duyệt mobile kịp đọc File.
      window.setTimeout(() => input.remove(), 0);
    },
    { once: true }
  );
  input.click();
}

/** Nén ảnh (data URL) trước khi upload — tránh vượt limit body / treo preview. */
export function compressImageDataUrl(
  dataUrl: string,
  options?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1600;
  const quality = options?.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const longest = Math.max(image.width, image.height) || 1;
        const scale = longest > maxEdge ? maxEdge / longest : 1;
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Không thể đọc ảnh để nén.'));
    image.src = dataUrl;
  });
}
