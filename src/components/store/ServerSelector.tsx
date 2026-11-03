import React from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Zap, Radio } from 'lucide-react';

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

export const ServerSelector: React.FC = () => {
  const { selectedServer, setSelectedServer } = useApp();

  const getBtnClasses = (isActive: boolean) =>
    `relative flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl border transition-all duration-150 active:scale-[0.98] ${
      isActive
        ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] border-[#a78bfa]/60 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)] font-bold'
        : 'bg-[#151520]/80 border-[#252535] text-[#a1a1aa] hover:border-[#38384d] hover:text-white hover:bg-[#1a1a28]'
    }`;

  return (
    <div className="w-full flex flex-col gap-1.5 py-1.5 select-none">
      {/* ROW 1: Server 1 & Server 2 (with Telegram logos and red dots) */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Server 1: Telegram Accounts / Global 2FA */}
        <button
          onClick={() => setSelectedServer(1)}
          className={getBtnClasses(selectedServer === 1)}
          type="button"
        >
          {/* Red Notification Dot on top right */}
          <span className="absolute top-1.5 right-2 flex h-2 w-2 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
          </span>

          <TelegramIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 1 ? 'text-white' : 'text-[#229ED9]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-bold leading-tight truncate">Server 1</span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 1 ? 'text-white/85' : 'text-[#71717a]'
              }`}
            >
              Global 2FA
            </span>
          </div>
        </button>

        {/* Server 2: Telegram Sessions / Aged */}
        <button
          onClick={() => setSelectedServer(2)}
          className={getBtnClasses(selectedServer === 2)}
          type="button"
        >
          {/* Red Notification Dot on top right */}
          <span className="absolute top-1.5 right-2 flex h-2 w-2 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
          </span>

          <TelegramIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 2 ? 'text-white' : 'text-[#229ED9]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-bold leading-tight truncate">Server 2</span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 2 ? 'text-white/85' : 'text-[#71717a]'
              }`}
            >
              Aged Sessions
            </span>
          </div>
        </button>
      </div>

      {/* ROW 2: Social Media Service / SMM (Server 5) - Full Width Banner */}
      <button
        onClick={() => setSelectedServer(5)}
        className={`${getBtnClasses(selectedServer === 5)} w-full py-2.5`}
        type="button"
      >
        <Users
          className={`w-4 h-4 shrink-0 transition-colors ${
            selectedServer === 5 ? 'text-white' : 'text-[#a78bfa]'
          }`}
        />
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold leading-tight">
            Social Media Service
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
              selectedServer === 5
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-[#252538] text-[#a78bfa] border-[#383850]'
            }`}
          >
            SMM Hub
          </span>
        </div>
      </button>

      {/* ROW 3: Server 3 & Server 4 (Virtual OTP & Fresh Carrier Numbers) */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Server 3: Fast OTP */}
        <button
          onClick={() => setSelectedServer(3)}
          className={getBtnClasses(selectedServer === 3)}
          type="button"
        >
          <Zap
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 3 ? 'text-white' : 'text-[#eab308]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-bold leading-tight truncate">Server 3</span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 3 ? 'text-white/85' : 'text-[#71717a]'
              }`}
            >
              Fast OTP
            </span>
          </div>
        </button>

        {/* Server 4: Fresh Carrier Numbers */}
        <button
          onClick={() => setSelectedServer(4)}
          className={getBtnClasses(selectedServer === 4)}
          type="button"
        >
          <Radio
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 4 ? 'text-white' : 'text-[#10b981]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[12px] font-bold leading-tight truncate">Server 4</span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 4 ? 'text-white/85' : 'text-[#71717a]'
              }`}
            >
              Fresh Numbers
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
