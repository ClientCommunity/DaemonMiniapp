import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe2,
  Sparkles,
  Search,
} from 'lucide-react';
import { LiveSandboxDemo } from './LiveSandboxDemo';

interface HeroSectionProps {
  onOpenAuth: (mode: 'signin' | 'register') => void;
  onExploreRates: () => void;
  onGoogleSuccess?: (credential: string) => void;
}

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenAuth,
  onExploreRates,
  onGoogleSuccess,
}) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gsiRendered, setGsiRendered] = useState(false);

  // Initialize Google Sign In button in Hero if available
  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let initialized = false;

    const initHeroGoogle = () => {
      if (initialized) return;
      const google = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (config: Record<string, unknown>) => void;
              renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
            };
          };
        };
      })?.google;

      if (google?.accounts?.id && googleBtnRef.current) {
        initialized = true;
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: { credential?: string }) => {
              if (response.credential && onGoogleSuccess) {
                onGoogleSuccess(response.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 250,
          });
          setGsiRendered(true);
        } catch {
          setGsiRendered(false);
        }
      }
    };

    initHeroGoogle();
    if (!initialized) {
      checkInterval = setInterval(() => {
        initHeroGoogle();
        if (initialized && checkInterval) {
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [onGoogleSuccess]);

  return (
    <section className="relative pt-8 pb-16 lg:pt-14 lg:pb-24 overflow-hidden">
      {/* Background radial gradients adhering strictly to Lavender Dream */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(196, 181, 253, 0.35), transparent 70%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(221, 208, 255, 0.4), transparent 50%), radial-gradient(ellipse 40% 30% at 10% 70%, rgba(233, 213, 255, 0.3), transparent 60%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: High-Converting Value Proposition & Low-Friction CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#211536] tracking-tight leading-[1.15] mb-5">
              Real Virtual Numbers &amp; 2FA Sessions.{' '}
              <span className="text-[#6D28D9] relative inline-block">
                Instant Delivery.
                <svg
                  className="absolute -bottom-1.5 left-0 w-full h-2 text-[#C4B5FD]/70"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                >
                  <path d="M0,8 Q50,0 100,8" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>
            </h1>

            {/* Subheadline (Psychology: Answer skeptical questions upfront) */}
            <p className="text-base sm:text-lg text-[#211536]/80 leading-relaxed mb-8 max-w-2xl font-normal">
              Activate Telegram, WhatsApp, OpenAI, Google and 500+ platforms with private carrier numbers.
              Protected by our <strong className="font-bold text-[#211536]">100% Automated Refund Guarantee</strong>: if an SMS code isn&apos;t received within 3 minutes, your wallet is refunded instantly.
            </p>

            {/* Action CTAs: Low Friction Entry Points */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 mb-8">
              {/* Primary Rate Explorer */}
              <button
                type="button"
                onClick={onExploreRates}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-[0.99]"
              >
                <Search className="w-4 h-4" />
                <span>Explore Live Rates &amp; Stock</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              {/* Google Sign In Container / Quick Trigger */}
              <div className="flex items-center justify-center min-h-[44px]">
                <div ref={googleBtnRef} className={gsiRendered ? 'block' : 'hidden'} />
                {!gsiRendered && (
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signin')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-[#FAF8FF] border border-[#E5DCF4] hover:border-[#6D28D9] text-[#211536] font-semibold text-sm shadow-xs transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                )}
              </div>

              {/* Email Sign In / Registration trigger */}
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center justify-center px-4 py-3.5 text-xs sm:text-sm font-semibold text-[#6D28D9] hover:text-[#5B21B6] hover:underline"
              >
                Or use email &rarr;
              </button>
            </div>

            {/* Trust Proof Metrics Strip */}
            <div className="w-full pt-6 border-t border-[#E5DCF4]/70 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#211536]/60 mb-0.5">
                  <Zap className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>Speed</span>
                </div>
                <div className="text-base font-extrabold text-[#211536]">&lt; 3s Avg</div>
                <div className="text-[11px] text-[#211536]/50">Instant SMS sync</div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#211536]/60 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Warranty</span>
                </div>
                <div className="text-base font-extrabold text-emerald-600">100% Refund</div>
                <div className="text-[11px] text-[#211536]/50">No code = No pay</div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#211536]/60 mb-0.5">
                  <Globe2 className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>Coverage</span>
                </div>
                <div className="text-base font-extrabold text-[#211536]">180+ Countries</div>
                <div className="text-[11px] text-[#211536]/50">Tier-1 carriers</div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#211536]/60 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>Rates</span>
                </div>
                <div className="text-base font-extrabold text-[#211536]">From ₹10 / $0.12</div>
                <div className="text-[11px] text-[#211536]/50">Wholesale pricing</div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Live Verification Sandbox */}
          <div className="lg:col-span-5 flex justify-center">
            <LiveSandboxDemo onOpenRates={onExploreRates} />
          </div>

        </div>
      </div>
    </section>
  );
};
