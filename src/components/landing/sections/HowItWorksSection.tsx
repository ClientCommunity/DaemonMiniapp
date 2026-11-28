import React from 'react';
import { UserCheck, Globe, MessageSquare, ShieldCheck, ArrowRight } from 'lucide-react';

interface Step {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight: string;
}

const STEPS: Step[] = [
  {
    step: '01',
    title: 'Instant Sign In',
    description: '1-click Google authentication or email login. No lengthy personal data requests, instant wallet setup.',
    icon: UserCheck,
    highlight: 'Zero waiting',
  },
  {
    step: '02',
    title: 'Select Platform & Country',
    description: 'Choose from 500+ supported apps (Telegram, WhatsApp, OpenAI) and pick your target country from 180+ regions.',
    icon: Globe,
    highlight: 'Live rates & stock',
  },
  {
    step: '03',
    title: 'Receive Real-Time SMS',
    description: 'Get your private carrier number immediately. The SMS verification code streams directly to your dashboard in < 3s.',
    icon: MessageSquare,
    highlight: 'High delivery speed',
  },
  {
    step: '04',
    title: '100% Automated Refund Guard',
    description: 'If carrier networks fail to deliver an SMS within 180 seconds, your funds are automatically restored to your wallet.',
    icon: ShieldCheck,
    highlight: 'Zero financial risk',
  },
];

interface HowItWorksSectionProps {
  onGetStarted: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onGetStarted }) => {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-white border-b border-[#E5DCF4] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#211536] tracking-tight mb-4">
            How It Works: Simple, Fast &amp; Guaranteed
          </h2>
          <p className="text-sm sm:text-base text-[#211536]/70 leading-relaxed">
            From account creation to your first successful OTP verification in under 60 seconds.
            Transparent rules and zero trapped balance.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === STEPS.length - 1;

            return (
              <div
                key={step.step}
                className={`relative rounded-2xl p-6 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isLast ? 'bg-emerald-50/70' : 'bg-[#FAF8FF]'
                }`}
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-2xl font-black ${
                        isLast ? 'text-emerald-600' : 'text-[#6D28D9]'
                      }`}
                    >
                      {step.step}
                    </span>
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isLast ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EDE9FE] text-[#6D28D9]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-[#211536] mb-2">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-[#211536]/70 leading-relaxed mb-4">
                    {step.description}
                  </p>
                </div>

                {/* Highlight Badge */}
                <div className="pt-3 border-t border-[#E5DCF4]/60 flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold ${
                      isLast ? 'text-emerald-700' : 'text-[#6D28D9]'
                    }`}
                  >
                    ✓ {step.highlight}
                  </span>
                  {idx < 3 && (
                    <ArrowRight className="w-3.5 h-3.5 text-[#211536]/30 hidden lg:block" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Trigger Banner */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            <span>Ready to verify? Get Started in 30 Seconds</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};
