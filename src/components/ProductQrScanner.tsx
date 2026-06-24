import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanBarcode, X } from 'lucide-react';

interface ProductQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

export default function ProductQrScanner({ open, onClose, onScan }: ProductQrScannerProps) {
  const reactId = useId();
  const regionId = `product-qr-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError('');

    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        decodedText => {
          if (handledRef.current) return;
          handledRef.current = true;
          onScan(decodedText.trim());
          scanner.stop().catch(() => {});
          onClose();
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
  }, [open, onClose, onScan, regionId]);

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
          {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
          <p className="mt-3 text-center text-xs font-semibold text-zinc-500">
            Đưa mã QR vào khung hình — mã sản phẩm sẽ tự điền sau khi quét.
          </p>
        </div>
      </div>
    </div>
  );
}
