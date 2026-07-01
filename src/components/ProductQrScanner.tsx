import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanBarcode, X } from 'lucide-react';

interface ProductQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => boolean | void;
  closeAfterScan?: boolean;
}

type ScanFeedback = {
  type: 'success' | 'duplicate' | 'error';
  text: string;
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

export default function ProductQrScanner({
  open,
  onClose,
  onScan,
  closeAfterScan = false
}: ProductQrScannerProps) {
  const reactId = useId();
  const regionId = `product-qr-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef({ value: '', time: 0 });
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [feedbackPulse, setFeedbackPulse] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const applyScanResult = (raw: string) => {
    const code = parseQrProductCode(raw);
    if (!code) {
      setFeedback({ type: 'error', text: 'Mã QR không hợp lệ.' });
      setFeedbackPulse(prev => prev + 1);
      return false;
    }

    const accepted = onScanRef.current(raw) !== false;
    setFeedbackPulse(prev => prev + 1);

    if (accepted) {
      setFeedback({ type: 'success', text: `Đã thêm mã SP: ${code}` });
      if (closeAfterScan) {
        void scannerRef.current?.stop().catch(() => {});
        onCloseRef.current();
      }
      return true;
    }

    setFeedback({ type: 'duplicate', text: `Mã ${code} đã có — không thêm trùng.` });
    return false;
  };

  useEffect(() => {
    if (!open) {
      setManualCode('');
      setError('');
      setFeedback(null);
      setFeedbackPulse(0);
      return;
    }

    let cancelled = false;
    lastScanRef.current = { value: '', time: 0 };
    setError('');
    setFeedback(null);
    setFeedbackPulse(0);
    setIsStarting(true);

    const handleDecoded = (decodedText: string) => {
      const value = decodedText.trim();
      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (!value || (lastScan.value === value && now - lastScan.time < 1200)) return;

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
          await scanner.stop().catch(() => {});
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
      void scanner
        .stop()
        .catch(() => {})
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
      : feedback?.type === 'duplicate'
        ? 'qr-scan-pulse-duplicate'
        : feedback?.type === 'error'
          ? 'qr-scan-pulse-error'
          : '';

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
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
        <div className="p-4">
          <div id={regionId} className="min-h-[240px] overflow-hidden rounded-xl bg-zinc-950" />
          {isStarting && (
            <p className="mt-3 text-center text-xs font-semibold text-zinc-500">Đang mở camera...</p>
          )}
          {feedback && (
            <p
              key={feedbackPulse}
              className={`mt-3 rounded-xl border-2 px-3 py-3 text-center text-sm font-black ${feedbackClass} ${
                feedback.type === 'success'
                  ? 'border-emerald-500 text-emerald-800'
                  : feedback.type === 'duplicate'
                    ? 'border-amber-500 text-amber-800'
                    : 'border-rose-500 text-rose-700'
              }`}
            >
              {feedback.text}
            </p>
          )}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
          <p className="mt-3 text-center text-xs font-semibold text-zinc-500">
            Đưa mã QR vào khung hình hoặc nhập mã SP thủ công.
          </p>
          <div className="mt-3 flex gap-2">
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
              Thêm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
