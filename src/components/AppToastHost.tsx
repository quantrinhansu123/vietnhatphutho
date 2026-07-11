import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { subscribeAppToast, type AppToastPayload } from '../lib/appToast';

const TOAST_DURATION_MS = 3000;

export default function AppToastHost() {
  const [toasts, setToasts] = useState<AppToastPayload[]>([]);

  useEffect(() => {
    return subscribeAppToast(toast => {
      setToasts(prev => [...prev, toast]);
      window.setTimeout(() => {
        setToasts(prev => prev.filter(item => item.id !== toast.id));
      }, TOAST_DURATION_MS);
    });
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed left-4 right-4 top-14 z-[80] mx-auto flex max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`flex items-start gap-2 rounded-2xl border p-3 text-[12.5px] font-semibold leading-relaxed shadow-lg backdrop-blur-xl ${
              toast.type === 'success'
                ? 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 to-white/90 text-emerald-700'
                : 'border-rose-200/70 bg-gradient-to-br from-rose-50/95 to-white/90 text-rose-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            )}
            <p className="flex-1">{toast.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
