import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react';
import { DEAMON_BRAND_LOGO } from '../../../assets/brandLogo';

const LOGO_FALLBACK = `${((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '')}/deamon-logo.png`;

interface CallToActionSectionProps {
  onGetStarted: () => void;
  onExploreRates: () => void;
}

export const CallToActionSection: React.FC<CallToActionSectionProps> = ({
  onGetStarted,
  onExploreRates,
}) => {
  return (
    <section className="relative py-20 bg-white border-b border-[#E5DCF4] overflow-hidden">
      {/* Background glow adhering to Lavender Dream */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(196, 181, 253, 0.25), transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Brand Logo Badge */}
        <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center p-2.5 shadow-md mx-auto mb-6 shrink-0 overflow-hidden ring-4 ring-[#EDE9FE]">
          <img
            src={DEAMON_BRAND_LOGO}
            alt="Daemon OTP Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.src = LOGO_FALLBACK;
            }}
          />
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#211536] tracking-tight mb-6">
          Ready to Start Verifying in Under 60 Seconds?
        </h2>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#211536]/75 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Join thousands of developers, agencies, and businesses who rely on Daemon OTP for high-delivery carrier numbers and automated refund protection.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <button
            type="button"
            onClick={onGetStarted}
            className="btn-25d-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm sm:text-base cursor-pointer"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onExploreRates}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#FAF8FF] hover:bg-[#EDE9FE] text-[#211536] font-semibold text-sm sm:text-base transition-all shadow-sm cursor-pointer"
          >
            <span>Browse Rates Catalog</span>
          </button>
        </div>

        {/* Trust Badges Row */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#211536]/70">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span className="font-semibold text-[#211536]">Zero Wait Time</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-[#211536]">100% Automated Refund Guard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span className="font-semibold text-[#211536]">No Identity Verification Required</span>
          </div>
        </div>

      </div>
    </section>
  );
};
