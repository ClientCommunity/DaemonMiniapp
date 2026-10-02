import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[92%] max-w-[400px] pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-up ${
              isSuccess
                ? 'bg-[#121217]/95 border-[#22c55e]/40 shadow-green-glow/20 text-white'
                : isError
                ? 'bg-[#121217]/95 border-[#ef4444]/40 shadow-[0_0_16px_rgba(239,68,68,0.25)] text-white'
                : isWarning
                ? 'bg-[#121217]/95 border-[#f59e0b]/40 shadow-amber-glow/20 text-white'
                : 'bg-[#121217]/95 border-[#7c3aed]/40 shadow-violet-glow-sm text-white'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />}
              {isError && <AlertCircle className="w-5 h-5 text-[#ef4444]" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-[#8b5cf6]" />}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-xs font-bold tracking-wide uppercase text-white/90 mb-0.5">
                  {toast.title}
                </div>
              )}
              <div className="text-xs font-medium text-[#d1d5db] leading-relaxed break-words">
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
