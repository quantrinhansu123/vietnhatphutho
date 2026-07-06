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
      input.remove();
    },
    { once: true }
  );
  input.click();
}
