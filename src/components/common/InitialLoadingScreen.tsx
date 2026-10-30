import React, { useState, useEffect } from 'react';
import { Zap, Sparkles } from 'lucide-react';

interface InitialLoadingScreenProps {
  statusMessage?: string;
  step?: number;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  step = 1,
}) => {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) {
          clearInterval(timer);
          return 96;
        }
        const diff = 96 - prev;
        const increment = Math.max(1, Math.floor(diff * 0.12));
        return Math.min(96, prev + increment);
      });
    }, 45);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step && step >= 3) {
      setProgress(100);
    }
  }, [step]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, progress) / 100) * circumference;

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col items-center justify-between py-12 px-6 shadow-2xl border-x border-[#181820]/40 overflow-hidden select-none">
      {/* Background Cyber Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#7c3aed]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#3b82f6]/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Top Subtle Status Badge */}
      <div className="w-full flex items-center justify-center pt-4">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181820]/60 border border-[#262630]/60 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[11px] font-medium text-[#a1a1aa] tracking-wide">SYSTEM ONLINE</span>
        </div>
      </div>

      {/* Center Stage: Circular Progress Meter & Emblem */}
      <div className="flex flex-col items-center justify-center my-auto w-full">
        {/* Modern Circular Progress Ring */}
        <div className="relative flex items-center justify-center mb-8">
          {/* Subtle outer breathing glow ring */}
          <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-[#7c3aed]/20 to-[#3b82f6]/20 blur-xl animate-pulse" />

          {/* SVG Progress Circle */}
          <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 130 130">
            <defs>
              <linearGradient id="krishLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {/* Background Track */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="#181820"
              strokeWidth="5"
              fill="transparent"
            />
            {/* Animated Progress Stroke */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="url(#krishLoaderGrad)"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: 'stroke-dashoffset 150ms ease-out',
              }}
            />
          </svg>

          {/* Center Emblem inside the Circle */}
          <div className="absolute w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#181820] to-[#121217] flex items-center justify-center shadow-inner border border-white/10 backdrop-blur-md">
            <div className="relative">
              <Zap className="w-9 h-9 text-[#a78bfa] fill-[#8b5cf6]/20 drop-shadow-[0_0_12px_rgba(139,92,246,0.6)] animate-pulse" />
              <Sparkles className="w-3.5 h-3.5 text-[#38bdf8] absolute -top-1 -right-1 animate-spin [animation-duration:6s]" />
            </div>
          </div>
        </div>

        {/* Title & Slogan */}
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-2xl font-black tracking-wider text-white uppercase flex items-center gap-1.5">
            KRISH <span className="bg-gradient-to-r from-[#a78bfa] via-[#818cf8] to-[#38bdf8] bg-clip-text text-transparent">STORE</span>
          </h1>
          <p className="text-xs text-[#a1a1aa] font-medium tracking-wider uppercase mt-1">
            Virtual Numbers & Services Hub
          </p>
        </div>

        {/* Minimal Modern Loading Bar & Percentage */}
        <div className="w-full max-w-[240px] flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs font-mono text-[#a1a1aa] mb-2 px-0.5">
            <span className="flex items-center gap-1.5 text-[#e4e4e7] font-medium">
              <span>Loading</span>
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[#8b5cf6] animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-[#8b5cf6] animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-[#8b5cf6] animate-bounce [animation-delay:300ms]" />
              </span>
            </span>
            <span className="font-bold text-white tracking-tight">{Math.min(100, Math.round(progress))}%</span>
          </div>

          <div className="w-full h-1.5 bg-[#181820] rounded-full overflow-hidden p-[1px] border border-[#262630]/70">
            <div
              className="h-full bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#06b6d4] rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-150 ease-out"
              style={{ width: `${Math.min(100, Math.round(progress))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Secure Badge */}
      <div className="w-full flex items-center justify-center pb-2">
        <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] font-mono">
          <Zap className="w-3 h-3 text-[#22c55e]" />
          <span>Telegram Mini App • Fast & Encrypted</span>
        </div>
      </div>
    </div>
  );
};
