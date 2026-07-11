/**
 * Chờ toàn bộ ảnh trong trang (logo, ảnh chụp, QR...) tải/giải mã xong trước khi in.
 * Trên điện thoại (mạng/CPU chậm hơn desktop) một khoảng setTimeout cố định thường
 * không đủ, khiến window.print() chạy trước khi ảnh load xong và bản in bị trắng/thiếu ảnh.
 */
export function waitForPrintImagesReady(maxWaitMs = 4000): Promise<void> {
  return new Promise(resolve => {
    const images = Array.from(document.images).filter(img => !img.complete);
    if (images.length === 0) {
      resolve();
      return;
    }

    let remaining = images.length;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      resolve();
    };

    const onImageSettled = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };

    images.forEach(img => {
      img.addEventListener('load', onImageSettled, { once: true });
      img.addEventListener('error', onImageSettled, { once: true });
    });

    const fallbackTimer = window.setTimeout(finish, maxWaitMs);
  });
}
