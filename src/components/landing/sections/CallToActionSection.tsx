import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react';

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
        {/* Trust pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#EDE9FE] text-[#6D28D9] mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Instant Setup • No Waiting Time</span>
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all transform active:scale-[0.99]"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onExploreRates}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#FAF8FF] hover:bg-[#EDE9FE] border border-[#E5DCF4] text-[#211536] font-semibold text-sm sm:text-base transition-all"
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
