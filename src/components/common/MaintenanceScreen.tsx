import React from 'react';
import { WifiOff, RefreshCw, MessageSquare, ShieldAlert } from 'lucide-react';

interface MaintenanceScreenProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  onRetry,
  isRetrying,
}) => {
  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col items-center justify-center p-6 shadow-2xl border-x border-[#181820]/40 select-none">
      {/* Ambient Red/Amber Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Center Icon */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="w-20 h-20 rounded-3xl bg-[#181820] border border-[#262630] flex items-center justify-center shadow-2xl">
          <WifiOff className="w-9 h-9 text-red-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold mb-3">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span>Service Unavailable</span>
      </div>

      {/* Heading & Notice */}
      <h2 className="text-xl font-extrabold text-white text-center tracking-tight mb-2">
        Backend Disconnected
      </h2>
      <p className="text-xs text-[#a1a1aa] text-center max-w-xs leading-relaxed mb-8">
        We could not establish a connection to Daemon Edge servers. The network might be undergoing maintenance or your internet connection is interrupted.
      </p>

      {/* Action Buttons */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-extrabold text-xs shadow-violet-glow transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Connecting to Backend...' : 'Retry Connection'}</span>
        </button>

        <a
          href="https://t.me/patelkrish_99bot"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#181820] hover:bg-[#1f1f2a] text-[#a1a1aa] hover:text-white font-bold text-xs border border-[#262630] transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Contact Telegram Support</span>
        </a>
      </div>

      {/* Security note */}
      <div className="absolute bottom-6 text-[10px] text-[#52525b] font-mono">
        Krish Daemon Mini App • Production Server Monitor
      </div>
    </div>
  );
};
