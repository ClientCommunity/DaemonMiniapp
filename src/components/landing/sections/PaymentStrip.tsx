import React from 'react';
import { ShieldCheck, Zap, Percent, CheckCircle2 } from 'lucide-react';

interface Gateway {
  id: string;
  name: string;
  subtext: string;
  icon: string;
  badge?: string;
  iconClass?: string;
}

const GATEWAYS: Gateway[] = [
  {
    id: 'gpay',
    name: 'Google Pay',
    subtext: 'Instant UPI',
    icon: '/icons/gpay.svg',
    iconClass: 'h-5 w-auto',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    subtext: 'Auto Credited',
    icon: '/icons/phonepe.svg',
    iconClass: 'w-5 h-5 rounded-full object-contain',
  },
  {
    id: 'paytm',
    name: 'Paytm UPI',
    subtext: 'Fast Verification',
    icon: '/icons/paytm.svg',
    iconClass: 'h-4 w-auto',
  },
  {
    id: 'upi',
    name: 'BHIM UPI',
    subtext: 'Any Bank App',
    icon: '/icons/upi.svg',
    badge: 'Popular',
    iconClass: 'h-4.5 w-auto',
  },
  {
    id: 'usdt',
    name: 'USDT Crypto',
    subtext: 'TRC-20 & BEP-20',
    icon: '/icons/tether.svg',
    badge: 'Global',
    iconClass: 'w-5 h-5 rounded-full object-contain',
  },
  {
    id: 'fampay',
    name: 'FamPay',
    subtext: 'Direct UPI Pay',
    icon: '/icons/fampay.svg',
    iconClass: 'w-5 h-5 object-contain',
  },
];

export const PaymentStrip: React.FC = () => {
  return (
    <section className="relative py-12 border-b border-[#E5DCF4] bg-[#FAF8FF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Guarantees Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-[#E5DCF4]/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EDE9FE] text-[#6D28D9]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-Fee Deposits
              </span>
              <span className="text-xs text-[#211536]/60 font-medium">Auto-credited in seconds</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#211536]">
              Instant Payment Gateways &amp; Crypto Settlement
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#211536]/75">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#E5DCF4] shadow-xs">
              <Percent className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span className="font-semibold text-[#211536]">0% Transaction Fee</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#E5DCF4] shadow-xs">
              <Zap className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span className="font-semibold text-[#211536]">&lt; 5s Auto-Crediting</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#E5DCF4] shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6D28D9]" />
              <span className="font-semibold text-[#211536]">Encrypted &amp; Verified</span>
            </div>
          </div>
        </div>

        {/* Gateways Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {GATEWAYS.map((gw) => (
            <div
              key={gw.id}
              className="group relative bg-white hover:bg-[#FAF8FF] border border-[#E5DCF4] hover:border-[#6D28D9] rounded-2xl p-4 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col items-center text-center justify-center min-h-[92px]"
            >
              {gw.badge && (
                <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#6D28D9] text-white shadow-xs">
                  {gw.badge}
                </span>
              )}
              <div className="h-7 flex items-center justify-center mb-2">
                <img
                  src={gw.icon}
                  alt={gw.name}
                  className={`${gw.iconClass || 'h-5 w-auto'} transition-transform group-hover:scale-105`}
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to text if icon fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-xs font-bold text-[#211536] leading-tight block">
                {gw.name}
              </span>
              <span className="text-[11px] text-[#211536]/55 font-medium mt-0.5">
                {gw.subtext}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
