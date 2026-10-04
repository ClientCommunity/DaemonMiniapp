import React from 'react';
import { ShieldCheck, RefreshCw, Zap } from 'lucide-react';

interface InitialLoadingScreenProps {
  statusMessage?: string;
  step?: number;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  statusMessage = 'Connecting to Daemon Secure Network...',
  step = 1,
}) => {
  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col items-center justify-center p-6 shadow-2xl border-x border-[#181820]/40 overflow-hidden select-none">
      {/* Background Cyber Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#7c3aed]/15 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#22c55e]/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Center Branding & Animated Ring */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer Pulsing Glow Ring */}
        <div className="absolute w-28 h-28 rounded-full border border-[#7c3aed]/40 animate-ping opacity-30" />
        {/* Rotating Dash Ring */}
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#8b5cf6]/60 animate-spin [animation-duration:8s] flex items-center justify-center" />
        
        {/* Core Shield Emblem */}
        <div className="absolute w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shadow-[0_0_35px_rgba(124,58,237,0.5)] border border-white/20">
          <ShieldCheck className="w-8 h-8 text-white drop-shadow" />
        </div>
      </div>

      {/* App Title & Slogan */}
      <div className="flex flex-col items-center text-center mb-10">
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-2xl font-black tracking-wider text-white uppercase">
            DAEMON <span className="text-[#8b5cf6]">OTP</span>
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/40">
            v2.6
          </span>
        </div>
        <p className="text-xs text-[#a1a1aa] font-medium tracking-wide">
          Decentralized Verification & Automation Hub
        </p>
      </div>

      {/* Status Progress Container */}
      <div className="w-full max-w-xs flex flex-col items-center bg-[#181820]/80 backdrop-blur-md border border-[#262630] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2.5 text-xs text-white font-medium mb-3">
          <RefreshCw className="w-4 h-4 text-[#8b5cf6] animate-spin" />
          <span className="truncate">{statusMessage}</span>
        </div>

        {/* Multi-step progress dots */}
        <div className="w-full grid grid-cols-3 gap-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              step >= 1 ? 'bg-[#8b5cf6]' : 'bg-[#262630]'
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              step >= 2 ? 'bg-[#8b5cf6]' : 'bg-[#262630]'
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              step >= 3 ? 'bg-[#22c55e]' : 'bg-[#262630]'
            }`}
          />
        </div>

        <div className="flex justify-between w-full mt-2 text-[10px] text-[#71717a] font-mono">
          <span className={step >= 1 ? 'text-[#a78bfa]' : ''}>1. Handshake</span>
          <span className={step >= 2 ? 'text-[#a78bfa]' : ''}>2. Auth</span>
          <span className={step >= 3 ? 'text-[#22c55e]' : ''}>3. Catalogues</span>
        </div>
      </div>

      {/* Bottom Secure Badge */}
      <div className="absolute bottom-6 flex items-center gap-1.5 text-[11px] text-[#52525b] font-mono">
        <Zap className="w-3.5 h-3.5 text-[#22c55e]" />
        <span>Telegram WebApp End-to-End Encrypted</span>
      </div>
    </div>
  );
};
