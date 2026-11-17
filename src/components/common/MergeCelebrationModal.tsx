import React from 'react';
import { CheckCircle2, Globe, Smartphone, Sparkles, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { useApp } from '../../context/AppContext';

interface MergeCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: string | number;
  message?: string;
}

export const MergeCelebrationModal: React.FC<MergeCelebrationModalProps> = ({
  isOpen,
  onClose,
  telegramId,
  message,
}) => {
  const { user, formatPrice, theme } = useApp();
  const isLight = theme === 'light';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 sm:p-7 text-center space-y-5">
        {/* Glowing Icon */}
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shadow-md animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Accounts Unified
          </div>
          <h3 className={`text-xl sm:text-2xl font-black ${isLight ? 'text-[#211536]' : 'text-white'}`}>
            Telegram Account Merged!
          </h3>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-sm mx-auto ${isLight ? 'text-[#74638B]' : 'text-zinc-400'}`}>
            {message || 'Your Telegram Bot account has been successfully linked with your daemonx.in website account.'}
          </p>
        </div>

        {/* Combined Account Details Card */}
        <div className={`p-4 rounded-2xl border text-left space-y-3 ${
          isLight ? 'bg-[#FAF8FF] border-[#E5DCF4]' : 'bg-[#14141b] border-[#262635]'
        }`}>
          <div className="flex items-center justify-between pb-2.5 border-b border-[#262635]/40">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#7C3AED]" />
              <span className={`text-xs font-semibold ${isLight ? 'text-[#514364]' : 'text-zinc-400'}`}>
                Telegram User ID
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-500">
              {telegramId}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span className={`text-xs font-semibold ${isLight ? 'text-[#514364]' : 'text-zinc-400'}`}>
                Combined Wallet Balance
              </span>
            </div>
            <span className="font-mono text-sm font-extrabold text-emerald-400">
              {formatPrice(user.balance)}
            </span>
          </div>

          <div className={`text-[11px] leading-snug p-2.5 rounded-xl ${
            isLight ? 'bg-white border border-[#E5DCF4] text-[#514364]' : 'bg-[#1a1a24] text-zinc-400'
          }`}>
            &bull; Real-time sync: Any number purchase or deposit reflects immediately on both Telegram and Web.
          </div>
        </div>

        {/* Dismiss / Continue Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer"
        >
          <span>Continue to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </Modal>
  );
};
