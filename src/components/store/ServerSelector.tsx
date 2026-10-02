import React from 'react';
import { useApp } from '../../context/AppContext';
import { ServerId } from '../../types';

export const ServerSelector: React.FC = () => {
  const { selectedServer, setSelectedServer } = useApp();

  const servers: { id: ServerId; title: string; badge: string }[] = [
    { id: 1, title: 'Server 1', badge: 'LZT Market' },
    { id: 2, title: 'Server 2', badge: 'Local Stock' },
    { id: 3, title: 'Server 3', badge: 'Fast OTP' },
    { id: 4, title: 'Server 4', badge: 'Fresh Numbers' },
    { id: 5, title: 'Server 5', badge: 'SMM Services' },
  ];

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 -mx-4 px-4 flex items-center gap-2">
      {servers.map((s) => {
        const isActive = selectedServer === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setSelectedServer(s.id)}
            className={`shrink-0 flex flex-col items-center justify-center px-3.5 py-2 rounded-xl border text-xs transition-all active:scale-95 ${
              isActive
                ? 'bg-[#7c3aed] border-[#8b5cf6] text-white shadow-[0_0_12px_rgba(124,58,237,0.5)] font-bold'
                : 'bg-[#181820] border-[#262630] text-[#a1a1aa] hover:text-white hover:border-[#383848]'
            }`}
          >
            <span className="text-[12px] font-bold leading-tight">{s.title}</span>
            <span className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-white/90' : 'text-[#a1a1aa]'}`}>
              {s.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
};
