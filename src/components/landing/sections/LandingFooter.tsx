import React from 'react';
import { ShieldCheck, Mail, Send } from 'lucide-react';
import { DEAMON_BRAND_LOGO } from '../../../assets/brandLogo';

const LOGO_FALLBACK = `${((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || '/').replace(/\/$/, '')}/deamon-logo.png`;

interface LandingFooterProps {
  onOpenTermsModal: () => void;
  onExploreRates: () => void;
  onExploreServer: (serverId: number) => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onOpenTermsModal,
  onExploreRates,
  onExploreServer,
}) => {
  return (
    <footer className="bg-[#FAF8FF] border-t border-[#E5DCF4] pt-16 pb-12 text-[#211536]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[#E5DCF4]/80">
          
          {/* Column 1: Brand & Status (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center p-1 shadow-xs border border-[#E5DCF4] overflow-hidden">
                <img
                  src={DEAMON_BRAND_LOGO}
                  alt="Daemon OTP Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = LOGO_FALLBACK;
                  }}
                />
              </div>
              <span className="text-xl font-extrabold text-[#211536] tracking-tight">
                Daemon<span className="text-[#6D28D9]">OTP</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#211536]/70 leading-relaxed max-w-sm">
              Enterprise-grade virtual numbers, carrier SMS verification, and aged 2FA sessions. Built with zero-wait delivery and 100% automated refund protection.
            </p>

            {/* Live Operational Status */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5DCF4] text-xs font-semibold shadow-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[#211536]">All 4 Server Pipelines Operational</span>
            </div>
          </div>

          {/* Column 2: Products & Servers (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D28D9]">
              Products &amp; Infrastructure
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#211536]/75 font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => onExploreServer(1)}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Server 1 · Global 2FA Accounts
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onExploreServer(2)}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Server 2 · Aged Local Sessions (.session)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onExploreServer(3)}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Server 3 &amp; 4 · Carrier SMS OTPs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onExploreServer(5)}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Server 5 · SMM Social Growth
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onExploreRates}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Live Rate Calculator &amp; Catalog
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust & Ecosystem (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D28D9]">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#211536]/75 font-medium">
              <li>
                <a
                  href="https://t.me/DeamonOTPbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#6D28D9] transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>@DeamonOTPbot</span>
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/DeamonOTP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#6D28D9] transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>Official Channel</span>
                </a>
              </li>
              <li>
                <span className="text-[#211536]/50">Zero-Fee UPI &amp; USDT</span>
              </li>
              <li>
                <span className="text-[#211536]/50">100% Auto-Refund Guard</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Official Inboxes (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6D28D9]">
              Legal &amp; Support Inboxes
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#211536]/75 font-medium">
              <li>
                <button
                  type="button"
                  onClick={onOpenTermsModal}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Terms of Service &amp; Fair Use
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenTermsModal}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Automated Refund Guarantee Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenTermsModal}
                  className="hover:text-[#6D28D9] transition-colors"
                >
                  Privacy &amp; Data Security
                </button>
              </li>
              <li className="pt-2">
                <a
                  href="mailto:official@daemonx.in"
                  className="inline-flex items-center gap-1.5 text-xs text-[#211536]/80 hover:text-[#6D28D9] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>official@daemonx.in</span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:dev@daemonx.in"
                  className="inline-flex items-center gap-1.5 text-xs text-[#211536]/80 hover:text-[#6D28D9] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>dev@daemonx.in</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright & Guarantee Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#211536]/60">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Daemon OTP &amp; DaemonX Technologies. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Guaranteed Delivery or 100% Refund</span>
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
