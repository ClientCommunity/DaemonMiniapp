import React from 'react';
import { useApp } from '../../context/AppContext';
import { PlusCircle, Smartphone, UserCheck, Rocket } from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

export const QuickActions: React.FC = () => {
  const { setActiveTab, setSelectedServer } = useApp();

  const handleAction = (tab: 'deposit' | 'store', serverId?: 1 | 2 | 3 | 4 | 5) => {
    hapticFeedback.light();
    setActiveTab(tab);
    if (serverId) {
      setSelectedServer(serverId);
    }
  };

  const actions = [
    {
      label: 'Add Cash',
      sub: 'Crypto & UPI',
      icon: PlusCircle,
      iconColor: 'text-[#22c55e]',
      bgColor: 'bg-[#22c55e]/15',
      onClick: () => handleAction('deposit'),
    },
    {
      label: 'Buy OTP',
      sub: 'Fast Numbers',
      icon: Smartphone,
      iconColor: 'text-[#a78bfa]',
      bgColor: 'bg-[#7c3aed]/20',
      onClick: () => handleAction('store', 3),
    },
    {
      label: 'Accounts',
      sub: 'Sessions & 2FA',
      icon: UserCheck,
      iconColor: 'text-sky-400',
      bgColor: 'bg-sky-500/15',
      onClick: () => handleAction('store', 2),
    },
    {
      label: 'SMM Boost',
      sub: 'Growth Tools',
      icon: Rocket,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      onClick: () => handleAction('store', 5),
    },
  ];

  return (
    <div className="grid grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 my-2.5">
      {actions.map((action, idx) => {
        const Icon = action.icon;
        return (
          <button
            key={idx}
            type="button"
            onClick={action.onClick}
            className="btn-25d-secondary flex flex-col items-center p-2.5 rounded-xl group cursor-pointer"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${action.bgColor}`}>
              <Icon className={`w-4 h-4 ${action.iconColor}`} />
            </div>
            <span className="text-[11px] font-bold text-center tracking-tight truncate w-full">
              {action.label}
            </span>
            <span className="text-[9px] text-[#a1a1aa] text-center truncate w-full">
              {action.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
};
