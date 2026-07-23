import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScanBarcode, X } from 'lucide-react';

interface ProductQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => boolean | 'incremented' | void;
  closeAfterScan?: boolean;
  requireConfirm?: boolean;
  getConfirmMessage?: (code: string) => string;
}

type ScanFeedback = {
  type: 'success' | 'duplicate' | 'error' | 'pending';
  text: string;
};

type PendingScan = {
  raw: string;
  code: string;
};

function isAppleMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ có thể báo MacIntel nhưng có touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, ms);
  });
}

/** iOS cần xin quyền trước rồi mới enumerate được camera ổn định. */
async function ensureCameraPermission() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'Camera trên iPhone cần HTTPS (hoặc localhost). Đang mở bằng HTTP LAN nên Safari chặn camera.'
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ camera.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' } }
  });
  stream.getTracks().forEach(track => track.stop());
}

async function pickCameraConfig(): Promise<string | MediaTrackConstraints> {
  try {
    await ensureCameraPermission();
  } catch (err) {
    // Vẫn thử facingMode — một số máy sẽ hiện prompt khi start().
    if (err instanceof Error && /HTTPS|localhost|không hỗ trợ/i.test(err.message)) {
      throw err;
    }
  }

  // Trên iPhone, facingMode ổn định hơn deviceId (label camera thường trống).
  if (isAppleMobile()) {
    return { facingMode: 'environment' };
  }

  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras?.length) {
      return { facingMode: 'environment' };
    }

    const backCamera = cameras.find(camera => /back|rear|environment|sau/i.test(camera.label));
    if (backCamera) return backCamera.id;

    const frontCamera = cameras.find(camera => /front|user|facetime|trước/i.test(camera.label));
    if (frontCamera && cameras.length > 1) {
      const other = cameras.find(camera => camera.id !== frontCamera.id);
      if (other) return other.id;
    }

    return cameras[cameras.length - 1].id;
  } catch {
    return { facingMode: 'environment' };
  }
}

function parseQrProductCode(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const plusIdx = trimmed.indexOf('+');
  if (plusIdx > 0) return trimmed.slice(0, plusIdx).trim();
  return trimmed;
}

const supportedProductCodeFormats = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E
];

function buildScannerConfig() {
  const apple = isAppleMobile();
  return {
    // iOS: fps thấp hơn giúp ổn định decode
    fps: apple ? 10 : 15,
    // aspectRatio 16:9 hay làm camera/portrait iPhone dừng quét
    ...(apple ? {} : { aspectRatio: 16 / 9 }),
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      if (apple) {
        // Khung vuông — QR/barcode trên iPhone nhận tốt hơn
        const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
        const clamped = Math.max(160, Math.min(size, 280));
        return { width: clamped, height: clamped };
      }
      const width = Math.floor(Math.min(viewfinderWidth * 0.9, 420));
      const height = Math.floor(Math.min(viewfinderHeight * 0.62, width, 240));
      return {
        width: Math.max(140, width),
        height: Math.max(120, height)
      };
    }
  };
}

async function stopScannerSafely(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    await scanner.stop();
  } catch {
    // Scanner có thể chưa khởi động xong hoặc đã dừng.
  }
}

async function improveIosFocus(scanner: Html5Qrcode) {
  if (!isAppleMobile()) return;
  try {
    await sleep(800);
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet]
    });
  } catch {
    // Một số máy không hỗ trợ focusMode — bỏ qua.
  }
}

export default function ProductQrScanner({
  open,
  onClose,
  onScan,
  closeAfterScan = false,
  requireConfirm = true,
  getConfirmMessage
}: ProductQrScannerProps) {
  const reactId = useId();
  const regionId = `product-qr-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const getConfirmMessageRef = useRef(getConfirmMessage);
  const lastScanRef = useRef({ value: '', time: 0 });
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [feedbackPulse, setFeedbackPulse] = useState(0);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    getConfirmMessageRef.current = getConfirmMessage;
  }, [getConfirmMessage]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const commitScanResult = (raw: string) => {
    const code = parseQrProductCode(raw);
    if (!code) {
      setFeedback({ type: 'error', text: 'Mã QR / mã vạch không hợp lệ.' });
      setFeedbackPulse(prev => prev + 1);
      return false;
    }

    const scanResult = onScanRef.current(raw);
    setFeedbackPulse(prev => prev + 1);

    if (scanResult === false) {
      setFeedback({ type: 'error', text: `Không thể thêm mã SP: ${code}` });
      return false;
    }

    if (scanResult === 'incremented') {
      setFeedback({ type: 'success', text: `Đã tăng SL mã ${code}` });
      if (closeAfterScan) {
        void stopScannerSafely(scannerRef.current);
        onCloseRef.current();
      }
      return true;
    }

    setFeedback({ type: 'success', text: `Đã thêm mã SP: ${code}` });
    if (closeAfterScan) {
      void stopScannerSafely(scannerRef.current);
      onCloseRef.current();
    }
    return true;
  };

  const queueScanResult = (raw: string) => {
    const code = parseQrProductCode(raw);
    if (!code) {
      setFeedback({ type: 'error', text: 'Mã QR / mã vạch không hợp lệ.' });
      setFeedbackPulse(prev => prev + 1);
      return false;
    }

    if (requireConfirm) {
      setPendingScan({ raw, code });
      const hint = getConfirmMessageRef.current?.(code) ?? `Mã SP: ${code}`;
      setFeedback({ type: 'pending', text: hint });
      setFeedbackPulse(prev => prev + 1);
      return true;
    }

    return commitScanResult(raw);
  };

  const confirmPendingScan = () => {
    if (!pendingScan) return;
    const { raw } = pendingScan;
    setPendingScan(null);
    lastScanRef.current = { value: '', time: 0 };
    commitScanResult(raw);
  };

  const cancelPendingScan = () => {
    setPendingScan(null);
    lastScanRef.current = { value: '', time: 0 };
    setFeedback(null);
  };

  const applyScanResult = (raw: string) => queueScanResult(raw);

  useEffect(() => {
    if (!open) {
      setManualCode('');
      setError('');
      setFeedback(null);
      setFeedbackPulse(0);
      setPendingScan(null);
      return;
    }

    let cancelled = false;
    lastScanRef.current = { value: '', time: 0 };
    setError('');
    setFeedback(null);
    setFeedbackPulse(0);
    setPendingScan(null);
    setIsStarting(true);

    const handleDecoded = (decodedText: string) => {
      const value = decodedText.trim();
      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (!value) return;
      // Debounce dài hơn trên iOS vì cùng mã có thể fire liên tục
      const debounceMs = isAppleMobile() ? 1200 : 500;
      if (lastScan.value === value && now - lastScan.time < debounceMs) return;

      lastScanRef.current = { value, time: now };
      applyScanResult(value);
    };

    const startScanner = async () => {
      // Đợi DOM region gắn xong (portal + iOS layout)
      await new Promise<void>(resolve => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      if (cancelled) return;

      const region = document.getElementById(regionId);
      if (!region) {
        if (!cancelled) {
          setIsStarting(false);
          setError('Không tìm thấy khung camera. Thử đóng và mở lại.');
        }
        return;
      }

      // iOS: chờ region có kích thước thật trước khi start
      if (isAppleMobile()) {
        for (let i = 0; i < 8; i += 1) {
          if (region.clientWidth > 40 && region.clientHeight > 40) break;
          await sleep(50);
        }
      }

      const scanner = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: supportedProductCodeFormats,
        // Safari BarcodeDetector thường experimental / không ổn → tắt trên iPhone
        useBarCodeDetectorIfSupported: !isAppleMobile()
      });
      scannerRef.current = scanner;

      let preferred: string | MediaTrackConstraints;
      try {
        preferred = await pickCameraConfig();
      } catch (err) {
        if (!cancelled) {
          setIsStarting(false);
          setError(
            err instanceof Error
              ? `${err.message} Bạn vẫn có thể nhập mã SP bên dưới.`
              : 'Không mở được camera. Hãy nhập mã SP bên dưới.'
          );
        }
        return;
      }

      const cameraConfigs: Array<string | MediaTrackConstraints> = [
        preferred,
        { facingMode: 'environment' },
        { facingMode: 'user' }
      ];

      const config = buildScannerConfig();
      let lastError = 'Không mở được camera.';
      for (const cameraConfig of cameraConfigs) {
        if (cancelled) return;
        try {
          await scanner.start(cameraConfig, config, handleDecoded, () => {});
          if (cancelled) {
            await stopScannerSafely(scanner);
            return;
          }
          // Đảm bảo video playsInline trên iOS
          const video = region.querySelector('video');
          if (video) {
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.muted = true;
            void video.play().catch(() => {});
          }
          void improveIosFocus(scanner);
          setIsStarting(false);
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : lastError;
          await stopScannerSafely(scanner);
        }
      }

      if (!cancelled) {
        setIsStarting(false);
        setError(`${lastError} Hãy cấp quyền camera trong Cài đặt → Safari, hoặc nhập mã SP bên dưới.`);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      setIsStarting(false);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      void stopScannerSafely(scanner).finally(() => {
        try {
          scanner.clear();
        } catch {
          // ignore cleanup errors
        }
      });
    };
  }, [open, closeAfterScan, regionId]);

  const submitManualCode = () => {
    const value = manualCode.trim();
    if (!value) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập mã SP.' });
      setFeedbackPulse(prev => prev + 1);
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setError('');
    if (applyScanResult(value)) {
      setManualCode('');
    }
  };

  const feedbackClass =
    feedback?.type === 'success'
      ? 'qr-scan-pulse-success'
      : feedback?.type === 'pending'
        ? 'qr-scan-pulse-duplicate'
        : feedback?.type === 'duplicate'
          ? 'qr-scan-pulse-duplicate'
          : feedback?.type === 'error'
            ? 'qr-scan-pulse-error'
            : '';

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-hidden bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[92dvh]">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-[#ef1b2d]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">Quét QR / mã vạch sản phẩm</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div
            id={regionId}
            className="qr-scanner-region min-h-[220px] overflow-hidden rounded-xl bg-zinc-950 sm:min-h-[240px]"
          />
          {isStarting && (
            <p className="mt-3 text-center text-xs font-semibold text-zinc-500">Đang mở camera...</p>
          )}
          {feedback && (
            <p
              key={feedbackPulse}
              className={`mt-3 rounded-xl border-2 px-3 py-3 text-center text-sm font-black ${feedbackClass} ${
                feedback.type === 'success'
                  ? 'border-emerald-500 text-emerald-800'
                  : feedback.type === 'pending'
                    ? 'border-[#ef1b2d] text-zinc-900'
                    : feedback.type === 'duplicate'
                      ? 'border-amber-500 text-amber-800'
                      : 'border-rose-500 text-rose-700'
              }`}
            >
              {feedback.text}
            </p>
          )}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
          {!pendingScan && (
            <>
              <p className="mt-2.5 text-center text-xs font-semibold text-zinc-500 sm:mt-3">
                Đưa trọn mã vào khung, giữ rõ hai đầu vạch hoặc nhập mã SP thủ công.
              </p>
              <p className="mt-1 text-center text-[11px] font-medium text-zinc-400">
                Hỗ trợ QR, EAN-13, EAN-8, Code 128 và UPC.
                {isAppleMobile() ? ' Trên iPhone: cho phép Camera trong Cài đặt → Safari.' : ''}
              </p>
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-zinc-200 bg-white p-3 sm:p-4">
          {pendingScan ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelPendingScan}
                className="h-11 flex-1 rounded-lg border border-zinc-200 bg-white text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
              >
                Quét lại
              </button>
              <button
                type="button"
                onClick={confirmPendingScan}
                className="h-11 flex-1 rounded-lg bg-[#ef1b2d] text-sm font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                Xác nhận
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitManualCode();
                  }
                }}
                placeholder="Nhập mã SP"
                className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
              />
              <button
                type="button"
                onClick={submitManualCode}
                className="h-10 shrink-0 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                {requireConfirm ? 'Kiểm tra' : 'Thêm'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
