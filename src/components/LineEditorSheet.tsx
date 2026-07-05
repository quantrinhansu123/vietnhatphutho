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
            className="relative z-10 flex h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl border border-ink-200 bg-white shadow-2xl md:h-auto md:max-h-[88vh] md:rounded-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 md:px-6 md:py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-black text-ink-900 md:text-lg">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-xs font-semibold text-ink-500 md:text-sm">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <div className="space-y-3 md:space-y-4">{children}</div>
            </div>

            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-ink-200 bg-white px-4 py-3 md:px-6 md:py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-4 text-xs font-black text-ink-700 transition hover:bg-ink-50 md:h-12"
              >
                Huỷ
              </button>
              {onPrimary && (
                <button
                  type="button"
                  onClick={onPrimary}
                  disabled={primaryDisabled}
                  className={`flex h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 md:h-12 ${
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
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl"
          >
            <div className="px-6 pb-2 pt-6">
              <h3 className="text-lg font-black text-ink-900">{title}</h3>
              {description && (
                <p className="mt-2 text-sm font-semibold text-ink-600">{description}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-ink-200 bg-ink-50 px-6 py-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 items-center rounded-xl border border-ink-200 bg-white px-4 text-xs font-black text-ink-700 transition hover:bg-ink-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex h-10 items-center rounded-xl px-4 text-xs font-black text-white shadow-sm transition ${
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
