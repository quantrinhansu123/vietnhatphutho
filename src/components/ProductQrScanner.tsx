import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanBarcode, X } from 'lucide-react';

interface ProductQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  closeAfterScan?: boolean;
}

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
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    lastScanRef.current = { value: '', time: 0 };
    setError('');
    setLastScanned('');

    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 20, qrbox: { width: 280, height: 280 }, aspectRatio: 1.333334 },
        decodedText => {
          const value = decodedText.trim();
          const now = Date.now();
          const lastScan = lastScanRef.current;
          if (!value || (lastScan.value === value && now - lastScan.time < 1200)) return;

          lastScanRef.current = { value, time: now };
          setLastScanned(value);
          onScanRef.current(value);

          if (closeAfterScan) {
            scanner.stop().catch(() => {});
            onCloseRef.current();
          }
        },
        () => {}
      )
      .catch((err: Error) => {
        setError(err.message || 'Không mở được camera. Hãy cấp quyền truy cập camera.');
      });

    return () => {
      scanner.stop().catch(() => {});
      try {
        scanner.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    };
  }, [open, closeAfterScan, regionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center">
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
          <div id={regionId} className="overflow-hidden rounded-xl bg-zinc-950" />
          {lastScanned && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-700">
              Đã quét và thêm dòng
            </p>
          )}
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
          <p className="mt-3 text-center text-xs font-semibold text-zinc-500">
            Đưa mã QR vào khung hình, hệ thống sẽ tự thêm dòng sau khi quét.
          </p>
        </div>
      </div>
    </div>
  );
}
