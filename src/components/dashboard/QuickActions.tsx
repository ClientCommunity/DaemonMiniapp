import React from 'react';
import { useApp } from '../../context/AppContext';
import { PlusCircle, Smartphone, UserCheck, Rocket } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const { setActiveTab, setSelectedServer } = useApp();

  const handleAction = (tab: 'deposit' | 'store', serverId?: 1 | 2 | 3 | 4 | 5) => {
    setActiveTab(tab);
    if (serverId) {
      setSelectedServer(serverId);
    }
  };

  const actions = [
    {
      label: 'Add Cash',
      sub: 'FamPay & UPI',
      icon: PlusCircle,
      iconColor: 'text-[#22c55e]',
      bgColor: 'bg-[#22c55e]/15 border-[#22c55e]/30',
      onClick: () => handleAction('deposit')
    },
    {
      label: 'Buy OTP',
      sub: 'Fast Numbers',
      icon: Smartphone,
      iconColor: 'text-[#8b5cf6]',
      bgColor: 'bg-[#7c3aed]/15 border-[#7c3aed]/30',
      onClick: () => handleAction('store', 3)
    },
    {
      label: 'Accounts',
      sub: 'Sessions & 2FA',
      icon: UserCheck,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-500/15 border-blue-500/30',
      onClick: () => handleAction('store', 2)
    },
    {
      label: 'SMM Boost',
      sub: 'Growth Tools',
      icon: Rocket,
      iconColor: 'text-[#f59e0b]',
      bgColor: 'bg-amber-500/15 border-amber-500/30',
      onClick: () => handleAction('store', 5)
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-2 my-4">
      {actions.map((action, idx) => {
        const Icon = action.icon;
        return (
          <button
            key={idx}
            onClick={action.onClick}
            className="flex flex-col items-center p-2.5 rounded-xl bg-[#181820] border border-[#262630] hover:border-[#383848] active:scale-95 transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-2 transition-transform group-hover:scale-105 ${action.bgColor}`}>
              <Icon className={`w-5 h-5 ${action.iconColor}`} />
            </div>
            <span className="text-[11px] font-bold text-white text-center tracking-tight truncate w-full">
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
