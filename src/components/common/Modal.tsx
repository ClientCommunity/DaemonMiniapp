import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  children
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      {/* Background click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-[430px] bg-[#15151c] border-t border-[#262630] rounded-t-3xl shadow-2xl z-10 max-h-[90vh] flex flex-col animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-2 shrink-0">
          {/* Drag handle */}
          <div className="w-12 h-1 bg-[#262630] rounded-full mx-auto mb-3" />

          <div className="flex items-start justify-between gap-3">
            <div>
              {title && <h3 className="font-bold text-base text-white">{title}</h3>}
              {subtitle && <p className="text-xs text-[#a1a1aa] mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#1f1f2a] text-[#a1a1aa] hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="px-4 pb-4 overflow-y-auto flex-1 no-scrollbar">{children}</div>

        {/* Sticky Fixed Footer */}
        {footer && (
          <div className="p-3.5 bg-[#15151c] border-t border-[#262630] shrink-0 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
