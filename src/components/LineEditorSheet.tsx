import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryIcon?: React.ReactNode;
  destructive?: boolean;
};

export function LineEditorSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  primaryLabel = 'Lưu dòng',
  onPrimary,
  primaryDisabled,
  primaryIcon,
  destructive = false
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center md:items-center"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink-900/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative z-10 flex h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-lg border border-ink-200 bg-white shadow-2xl md:h-auto md:max-h-[88vh] md:rounded-lg"
          >
            <header className="flex shrink-0 items-start justify-between gap-2 border-b border-dashed border-ink-200 bg-white px-3 py-2.5 md:px-4 md:py-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-semibold text-ink-900 tracking-tight md:text-[15px]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-[11px] font-medium italic text-ink-500 md:text-xs">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
                aria-label="Đóng"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-3.5">
              <div className="space-y-2.5 md:space-y-3">{children}</div>
            </div>

            <footer className="flex shrink-0 items-center justify-end gap-1.5 border-t border-ink-200 bg-white px-3 py-2.5 md:px-4 md:py-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50 md:h-9"
              >
                Huỷ
              </button>
              {onPrimary && (
                <button
                  type="button"
                  onClick={onPrimary}
                  disabled={primaryDisabled}
                  className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 md:h-9 ${
                    destructive
                      ? 'bg-danger-500 hover:bg-danger-600'
                      : 'bg-brand-500 hover:bg-brand-700'
                  }`}
                >
                  {primaryIcon}
                  {primaryLabel}
                </button>
              )}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  onConfirm,
  destructive = false
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink-900/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-lg border border-ink-200 bg-white shadow-2xl"
          >
            <div className="px-4 pb-2 pt-4">
              <h3 className="text-[14px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
              {description && (
                <p className="mt-1.5 text-[12px] font-medium italic text-ink-600">{description}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-1.5 border-t border-ink-200 bg-ink-50 px-4 py-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 items-center rounded-md border border-ink-200 bg-white px-3 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex h-8 items-center rounded-md px-3 text-[11px] font-bold text-white shadow-sm transition ${
                  destructive
                    ? 'bg-danger-500 hover:bg-danger-600'
                    : 'bg-brand-500 hover:bg-brand-700'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default LineEditorSheet;