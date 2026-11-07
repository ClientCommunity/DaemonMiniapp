import React from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Zap } from 'lucide-react';

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm5.79 14.15c-.24.68-1.39 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.14-.96-.32-1.65-.62-2.91-1.26-4.81-4.2-4.96-4.4-.14-.19-1.19-1.58-1.19-3.02 0-1.44.75-2.14 1.02-2.43.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.49.24.58.82 2 .89 2.15.07.15.12.33.02.53-.1.19-.15.31-.3.48-.15.17-.31.38-.45.51-.15.14-.3.3-.13.6.17.29.77 1.27 1.65 2.05 1.13 1 2.08 1.31 2.38 1.45.29.15.46.13.63-.07.17-.2.73-.85.93-1.14.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.49.22.56.34.07.12.07.72-.17 1.4z" />
  </svg>
);

export const ServerSelector: React.FC = () => {
  const { selectedServer, setSelectedServer, theme } = useApp();
  const isLight = theme === 'light';

  const getBtnClasses = (isActive: boolean) =>
    `relative flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl border transition-all duration-150 active:scale-[0.98] ${
      isActive
        ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] border-[#a78bfa]/60 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)] font-bold'
        : isLight
        ? 'bg-white border-[#e2e8f0] text-[#0f172a] hover:border-[#cbd5e1] hover:bg-[#f8fafc] shadow-sm'
        : 'bg-[#151520]/80 border-[#252535] text-[#a1a1aa] hover:border-[#38384d] hover:text-white hover:bg-[#1a1a28]'
    }`;

  return (
    <div className="w-full flex flex-col gap-1.5 py-1.5 select-none">
      {/* ROW 1: Server 1 (Cheap Quality - Yellow dot) & Server 2 (Good Quality - Green dot) */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Server 1: Cheap Quality */}
        <button
          onClick={() => setSelectedServer(1)}
          className={getBtnClasses(selectedServer === 1)}
          type="button"
        >
          {/* Yellow Notification Dot on top right */}
          <span className="absolute top-1.5 right-2 flex h-2 w-2 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
          </span>

          <TelegramIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 1 ? 'text-white' : 'text-[#229ED9]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[12px] font-bold leading-tight truncate ${selectedServer === 1 ? 'text-white' : isLight ? 'text-[#0f172a]' : 'text-white'}`}>
              Server 1
            </span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 1 ? 'text-white/85' : isLight ? 'text-[#64748b]' : 'text-[#71717a]'
              }`}
            >
              Cheap Quality
            </span>
          </div>
        </button>

        {/* Server 2: Good Quality */}
        <button
          onClick={() => setSelectedServer(2)}
          className={getBtnClasses(selectedServer === 2)}
          type="button"
        >
          {/* Green Notification Dot on top right */}
          <span className="absolute top-1.5 right-2 flex h-2 w-2 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_#22c55e]"></span>
          </span>

          <TelegramIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 2 ? 'text-white' : 'text-[#229ED9]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[12px] font-bold leading-tight truncate ${selectedServer === 2 ? 'text-white' : isLight ? 'text-[#0f172a]' : 'text-white'}`}>
              Server 2
            </span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 2 ? 'text-white/85' : isLight ? 'text-[#64748b]' : 'text-[#71717a]'
              }`}
            >
              Good Quality
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
            selectedServer === 5 ? 'text-white' : isLight ? 'text-[#7c3aed]' : 'text-[#a78bfa]'
          }`}
        />
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-bold leading-tight ${selectedServer === 5 ? 'text-white' : isLight ? 'text-[#0f172a]' : 'text-white'}`}>
            Social Media Service
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
              selectedServer === 5
                ? 'bg-white/20 text-white border-white/30'
                : isLight
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-[#252538] text-[#a78bfa] border-[#383850]'
            }`}
          >
            SMM Hub
          </span>
        </div>
      </button>

      {/* ROW 3: Server 3 & Server 4 (All apps) */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Server 3: All apps */}
        <button
          onClick={() => setSelectedServer(3)}
          className={getBtnClasses(selectedServer === 3)}
          type="button"
        >
          <Zap
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 3 ? 'text-white' : isLight ? 'text-amber-500' : 'text-[#eab308]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[12px] font-bold leading-tight truncate ${selectedServer === 3 ? 'text-white' : isLight ? 'text-[#0f172a]' : 'text-white'}`}>
              Server 3
            </span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 3 ? 'text-white/85' : isLight ? 'text-[#64748b]' : 'text-[#71717a]'
              }`}
            >
              All apps
            </span>
          </div>
        </button>

        {/* Server 4: All apps */}
        <button
          onClick={() => setSelectedServer(4)}
          className={getBtnClasses(selectedServer === 4)}
          type="button"
        >
          <WhatsAppIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              selectedServer === 4 ? 'text-white' : 'text-[#25D366]'
            }`}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className={`text-[12px] font-bold leading-tight truncate ${selectedServer === 4 ? 'text-white' : isLight ? 'text-[#0f172a]' : 'text-white'}`}>
              Server 4
            </span>
            <span
              className={`text-[9.5px] leading-tight truncate ${
                selectedServer === 4 ? 'text-white/85' : isLight ? 'text-[#64748b]' : 'text-[#71717a]'
              }`}
            >
              All apps
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
