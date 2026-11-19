import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Check,
  Copy,
  RefreshCw,
  Zap,
  Clock,
  Radio,
} from 'lucide-react';

interface DemoService {
  name: string;
  flag: string;
  country: string;
  number: string;
  service: string;
  code: string;
  message: string;
  carrier: string;
}

interface LiveSandboxDemoProps {
  onOpenRates?: () => void;
}

const DEMO_SERVICES: DemoService[] = [
  {
    name: 'Telegram Messenger',
    flag: '🇺🇸',
    country: 'United States',
    number: '+1 (202) 555-0194',
    service: 'Telegram',
    code: '849-201',
    message: 'Your Telegram login code is 849-201. Do not share this code with anyone.',
    carrier: 'T-Mobile US Tier-1',
  },
  {
    name: 'WhatsApp Business',
    flag: '🇮🇳',
    country: 'India',
    number: '+91 98204 11209',
    service: 'WhatsApp',
    code: '419-582',
    message: '<#> 419-582 is your WhatsApp Business verification code. Never disclose it.',
    carrier: 'Airtel Enterprise SIM',
  },
  {
    name: 'OpenAI / ChatGPT',
    flag: '🇬🇧',
    country: 'United Kingdom',
    number: '+44 7911 123456',
    service: 'OpenAI',
    code: '392-108',
    message: 'Your OpenAI verification code is 392-108. It will expire in 5 minutes.',
    carrier: 'Vodafone UK Mobile',
  },
  {
    name: 'Google & Gmail',
    flag: '🇺🇸',
    country: 'United States',
    number: '+1 (415) 555-8932',
    service: 'Google',
    code: '528-940',
    message: 'G-528940 is your Google verification code. Generated securely.',
    carrier: 'Verizon Carrier Pool',
  },
];

export const LiveSandboxDemo: React.FC<LiveSandboxDemoProps> = ({ onOpenRates: _onOpenRates }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(284);
  const [isSimulating, setIsSimulating] = useState(false);

  const active = DEMO_SERVICES[selectedIndex];

  // Countdown clock simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(active.code.replace('-', ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleSimulateNext = () => {
    setIsSimulating(true);
    setCopied(false);
    setTimeout(() => {
      setSelectedIndex((prev) => (prev + 1) % DEMO_SERVICES.length);
      setSecondsRemaining(300);
      setIsSimulating(false);
    }, 400);
  };

  return (
    <div
      className="w-full max-w-md mx-auto rounded-3xl border bg-white p-5 sm:p-6 shadow-xl relative overflow-hidden transition-all duration-300"
      style={{
        borderColor: '#E5DCF4',
        boxShadow: '0 16px 40px -8px rgba(109, 40, 217, 0.12), 0 4px 16px -2px rgba(109, 40, 217, 0.04)',
      }}
    >
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b" style={{ borderColor: '#F0E9FF' }}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#211536' }}>
            Live Carrier Sandbox
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-[#F0E9FF] border-[#DDD0FF] text-[#6D28D9]">
          <Radio className="w-3 h-3 text-[#6D28D9] animate-pulse" />
          <span>Active Feed</span>
        </div>
      </div>

      {/* Service Selector Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
        {DEMO_SERVICES.map((s, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => {
                setSelectedIndex(idx);
                setSecondsRemaining(300);
                setCopied(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 border ${
                isSelected
                  ? 'bg-[#6D28D9] text-white border-[#6D28D9] shadow-sm'
                  : 'bg-[#FAF8FF] text-[#514364] border-[#E5DCF4] hover:border-[#DDD0FF] hover:bg-[#F0E9FF]'
              }`}
            >
              <span>{s.flag}</span>
              <span className="truncate max-w-[90px]">{s.service}</span>
            </button>
          );
        })}
      </div>

      {/* Simulated Phone Line Card */}
      <div
        className={`p-3.5 rounded-2xl border mb-3 transition-opacity duration-300 ${
          isSimulating ? 'opacity-40' : 'opacity-100'
        }`}
        style={{ backgroundColor: '#FAF8FF', borderColor: '#E5DCF4' }}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[11px] font-medium" style={{ color: '#74638B' }}>
            Assigned Mobile Line
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-white border-emerald-200 text-emerald-700">
            {active.carrier}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#6D28D9]" />
            <span className="font-mono font-bold text-sm tracking-tight" style={{ color: '#211536' }}>
              {active.number}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
            <Clock className="w-3 h-3 text-[#74638B]" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Simulated Incoming Message Bubble */}
      <div
        className="p-4 rounded-2xl border relative mb-4 shadow-sm"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DDD0FF',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF8FF 100%)',
        }}
      >
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="font-bold" style={{ color: '#211536' }}>
              Incoming SMS Received
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">Just now</span>
        </div>

        <p className="text-xs leading-relaxed mb-3.5 font-sans" style={{ color: '#514364' }}>
          &ldquo;{active.message}&rdquo;
        </p>

        {/* Extracted OTP Badge with 1-Click Copy */}
        <div className="flex items-center justify-between p-2.5 rounded-xl border bg-white border-[#E5DCF4]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#74638B] tracking-wider">
              Verification Code
            </span>
            <span className="text-xl font-black font-mono tracking-wider" style={{ color: '#6D28D9' }}>
              {active.code}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm ${
              copied
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white hover:bg-violet-50 text-[#6D28D9] border-[#DDD0FF]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Trigger Button */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={handleSimulateNext}
          disabled={isSimulating}
          className="flex-1 min-h-[38px] py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-[#FAF8FF] hover:bg-[#F0E9FF] border-[#E5DCF4] text-[#542C85] cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>Simulate Next Carrier</span>
        </button>
      </div>

      {/* 100% Automated Refund Trust Shield */}
      <div
        className="p-3 rounded-xl border flex items-start gap-2.5 text-left"
        style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}
      >
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-emerald-950">
            100% Automated Refund Guarantee
          </span>
          <span className="text-[10.5px] text-emerald-800 leading-snug mt-0.5">
            If no SMS arrives within the countdown window, funds are credited back to your balance automatically. Zero manual tickets needed.
          </span>
        </div>
      </div>
    </div>
  );
};
