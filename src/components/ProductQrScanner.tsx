import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
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

async function pickCameraConfig(): Promise<string | MediaTrackConstraints> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras?.length) {
      return { facingMode: 'user' };
    }

    const backCamera = cameras.find(camera => /back|rear|environment|sau/i.test(camera.label));
    if (backCamera) return backCamera.id;

    const frontCamera = cameras.find(camera => /front|user|facetime|trước/i.test(camera.label));
    if (frontCamera) return frontCamera.id;

    return cameras[cameras.length - 1].id;
  } catch {
    return { facingMode: 'user' };
  }
}

function parseQrProductCode(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const plusIdx = trimmed.indexOf('+');
  if (plusIdx > 0) return trimmed.slice(0, plusIdx).trim();
  return trimmed;
}

const scannerConfig = {
  fps: 12,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const edge = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.max(180, Math.floor(edge * 0.72));
    return { width: size, height: size };
  }
};

async function stopScannerSafely(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    await scanner.stop();
  } catch {
    // Scanner có thể chưa khởi động xong hoặc đã dừng.
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

  const commitScanResult = (raw: string) => {
    const code = parseQrProductCode(raw);
    if (!code) {
      setFeedback({ type: 'error', text: 'Mã QR không hợp lệ.' });
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
      setFeedback({ type: 'error', text: 'Mã QR không hợp lệ.' });
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
      if (lastScan.value === value && now - lastScan.time < 500) return;

      lastScanRef.current = { value, time: now };
      applyScanResult(value);
    };

    const startScanner = async () => {
      await new Promise<void>(resolve => {
        window.requestAnimationFrame(() => resolve());
      });
      if (cancelled) return;

      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;

      const cameraConfigs: Array<string | MediaTrackConstraints> = [
        await pickCameraConfig(),
        { facingMode: 'environment' },
        { facingMode: 'user' }
      ];

      let lastError = 'Không mở được camera.';
      for (const cameraConfig of cameraConfigs) {
        if (cancelled) return;
        try {
          await scanner.start(cameraConfig, scannerConfig, handleDecoded, () => {});
          if (!cancelled) setIsStarting(false);
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : lastError;
          await stopScannerSafely(scanner);
        }
      }

      if (!cancelled) {
        setIsStarting(false);
        setError(`${lastError} Hãy cấp quyền camera hoặc nhập mã SP bên dưới.`);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      setIsStarting(false);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      void stopScannerSafely(scanner)
        .finally(() => {
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[92dvh]">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-[#ef1b2d]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">Quét mã QR sản phẩm</h3>
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
          <div id={regionId} className="qr-scanner-region min-h-[168px] overflow-hidden rounded-xl bg-zinc-950 sm:min-h-[240px]" />
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
          {pendingScan && (
            <div className="mt-3 flex gap-2">
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
          )}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
          {!pendingScan && (
            <>
              <p className="mt-2.5 text-center text-xs font-semibold text-zinc-500 sm:mt-3">
                Đưa mã QR vào khung hình hoặc nhập mã SP thủ công.
              </p>
              <div className="mt-2.5 flex gap-2 sm:mt-3">
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
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
