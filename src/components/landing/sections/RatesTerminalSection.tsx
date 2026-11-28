import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Zap,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { ServiceItem, ServiceCategory } from '../types';
import { DEFAULT_SERVICES } from '../data/landingData';
import { storeApi } from '../../../api/endpoints';

interface RatesTerminalSectionProps {
  onBuyNow: (service: ServiceItem, quantity: number) => void;
}

export const RatesTerminalSection: React.FC<RatesTerminalSectionProps> = ({ onBuyNow }) => {
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);

  // Search & filter state
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculator state
  const [calcServiceId, setCalcServiceId] = useState<string>(DEFAULT_SERVICES[0]?.id || 's1_in');
  const [calcQuantity, setCalcQuantity] = useState<number>(5);

  // Query live rates from backend on mount
  useEffect(() => {
    let isMounted = true;

    const fetchLiveRates = async () => {
      try {
        setIsLoadingLive(true);
        const res = await storeApi.getServer1();
        if (!isMounted) return;

        if (res && res.success && Array.isArray(res.items) && res.items.length > 0) {
          setIsLiveConnected(true);

          // Convert backend Server 1 items into ServiceItem format and merge with other categories
          const liveServer1Items: ServiceItem[] = res.items.slice(0, 15).map((item, idx) => {
            const country = item.country || item.name || 'Global';
            const priceInr = Number(item.price || 75);
            const priceUsdt = Number((priceInr / 92).toFixed(2));
            const stockNum = item.stock !== undefined ? Number(item.stock) : 100;
            const flag = item.flag || item.icon || '🌐';
            const stockStr = stockNum > 0 ? `${stockNum}+ In Stock` : 'Checking Stock';

            return {
              id: `s1_${item.id || idx}`,
              name: `Telegram 2FA (${country})`,
              server: 'Server 1',
              country,
              flag,
              category: 'session',
              priceInr,
              priceUsdt,
              stock: stockStr,
              stockText: stockStr,
              speed: 'Instant Download',
              deliverySpeed: 'Instant Download',
              format: 'ZIP (.session + TData + 2FA)',
              successRate: '99.8%',
              description: `Real-time marketplace inventory for ${country} with pre-checked 2FA credentials.`,
              badge: idx === 0 ? 'Live Stock' : undefined,
            };
          });

          // Keep non-server1 items (e.g. carrier SMS OTPs and SMM) from DEFAULT_SERVICES
          const otherItems = DEFAULT_SERVICES.filter((s) => s.category !== 'session');
          setServices([...liveServer1Items, ...otherItems]);
        }
      } catch {
        // Fallback gracefully to default catalog
        setIsLiveConnected(false);
      } finally {
        if (isMounted) setIsLoadingLive(false);
      }
    };

    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const matchesCategory = selectedCategory === 'all' || srv.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        srv.name.toLowerCase().includes(q) ||
        srv.country.toLowerCase().includes(q) ||
        srv.format.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  // Selected calculator service
  const selectedCalcService = useMemo(() => {
    return services.find((s) => s.id === calcServiceId) || services[0] || DEFAULT_SERVICES[0];
  }, [services, calcServiceId]);

  // Calculator price calculations
  const totalInr = selectedCalcService ? selectedCalcService.priceInr * calcQuantity : 0;
  const totalUsdt = selectedCalcService
    ? (selectedCalcService.priceUsdt * calcQuantity).toFixed(2)
    : '0.00';

  const handleQuantityPreset = (qty: number) => {
    setCalcQuantity(qty);
  };

  const handleQuantityStep = (delta: number) => {
    setCalcQuantity((prev) => Math.max(1, Math.min(100, prev + delta)));
  };

  return (
    <section
      id="rates"
      className="py-16 sm:py-24 border-b border-[#E5DCF4] relative"
      style={{
        background:
          'radial-gradient(ellipse 65% 45% at 85% 15%, rgba(196, 181, 253, 0.28), transparent 50%), radial-gradient(ellipse 50% 35% at 15% 85%, rgba(221, 208, 255, 0.32), transparent 45%), #FAF8FF',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#211536] tracking-tight">
              Live Service Terminal &amp; Instant Checkout
            </h2>
            <p className="text-sm sm:text-base text-[#211536]/70 mt-2 max-w-2xl">
              Transparent per-activation prices in INR (₹) and USDT ($). Select any service or quantity to proceed directly to instant fulfillment.
            </p>
          </div>

          {/* Live Status Pill */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl shadow-sm text-xs self-start lg:self-auto">
            <span className="flex h-2 w-2 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveConnected ? 'bg-emerald-400' : 'bg-violet-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected ? 'bg-emerald-500' : 'bg-[#6D28D9]'
                }`}
              />
            </span>
            <span className="font-semibold text-[#211536]">
              {isLiveConnected
                ? 'Live Server Stock Connected'
                : isLoadingLive
                ? 'Connecting Live Node...'
                : 'Verified Rates Active'}
            </span>
          </div>
        </div>

        {/* TOP: Quick Rate Calculator & Bulk Estimator Card */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm mb-12 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Calculator Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#6D28D9] uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Interactive Rate &amp; Bulk Order Calculator</span>
              </div>

              {/* Service Select */}
              <div>
                <label className="block text-xs font-semibold text-[#211536]/80 mb-1.5">
                  Choose Platform &amp; Category
                </label>
                <select
                  value={calcServiceId}
                  onChange={(e) => setCalcServiceId(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FAF8FF] border border-[#E5DCF4] rounded-xl text-sm font-semibold text-[#211536] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.flag} {s.name} ({s.country}) — ₹{s.priceInr} / ${s.priceUsdt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Stepper & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#211536]/80">
                    Order Quantity
                  </label>
                  <span className="text-xs text-[#211536]/60 font-medium">
                    Unit Price: <strong className="text-[#211536]">₹{selectedCalcService.priceInr}</strong> (${selectedCalcService.priceUsdt})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Stepper buttons */}
                  <div className="flex items-center border border-[#E5DCF4] rounded-xl bg-[#FAF8FF] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleQuantityStep(-1)}
                      className="px-3.5 py-2 hover:bg-[#EDE9FE] text-[#211536] transition-colors"
                      disabled={calcQuantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-5 py-2 font-bold text-sm text-[#211536] min-w-[50px] text-center">
                      {calcQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityStep(1)}
                      className="px-3.5 py-2 hover:bg-[#EDE9FE] text-[#211536] transition-colors"
                      disabled={calcQuantity >= 100}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5">
                    {[1, 5, 10, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuantityPreset(preset)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          calcQuantity === preset
                            ? 'bg-[#6D28D9] text-white shadow-xs'
                            : 'bg-[#FAF8FF] text-[#211536]/80 border border-[#E5DCF4] hover:border-[#6D28D9]'
                        }`}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Summary & Intent-Preserving Buy Now (5 cols) */}
            <div className="lg:col-span-5 bg-[#FAF8FF] border border-[#E5DCF4] rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-[#211536]/60 font-medium mb-1">
                  Estimated Total for {calcQuantity}x Activations
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl sm:text-4xl font-black text-[#211536]">
                    ₹{totalInr}
                  </span>
                  <span className="text-sm font-semibold text-[#211536]/60">
                    (${totalUsdt} USDT)
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-[#211536]/75 mb-6">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Instant automated delivery into your dashboard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
                    <span>100% Automated refund if SMS doesn&apos;t arrive in 180s</span>
                  </div>
                </div>
              </div>

              {/* BUY NOW with Carry-Over Intent */}
              <button
                type="button"
                onClick={() => onBuyNow(selectedCalcService, calcQuantity)}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-[0.99]"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Buy Now ({calcQuantity}x · ₹{totalInr})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Filter Chips & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Services' },
              { id: 'otp', label: 'Carrier SMS OTPs' },
              { id: 'session', label: 'Aged 2FA Sessions' },
              { id: 'smm', label: 'SMM Growth' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as ServiceCategory)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === tab.id
                    ? 'bg-[#6D28D9] text-white shadow-xs'
                    : 'bg-white text-[#211536]/80 border border-[#E5DCF4] hover:border-[#6D28D9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px] sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#211536]/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search service or country..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5DCF4] rounded-xl text-xs sm:text-sm text-[#211536] placeholder-[#211536]/40 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-[#E5DCF4] hover:border-[#6D28D9] p-5 transition-all duration-200 hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* Header row: Flag, Name, Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl" role="img" aria-label={service.country}>
                      {service.flag}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[#211536] group-hover:text-[#6D28D9] transition-colors leading-tight">
                        {service.name}
                      </h3>
                      <span className="text-xs text-[#211536]/60 font-medium">
                        {service.country}
                      </span>
                    </div>
                  </div>

                  {service.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EDE9FE] text-[#6D28D9]">
                      {service.badge}
                    </span>
                  )}
                </div>

                {/* Specs: Format & Speed */}
                <div className="space-y-1.5 py-3 border-y border-[#E5DCF4]/60 text-xs text-[#211536]/75 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#211536]/60">
                      <Layers className="w-3.5 h-3.5 text-[#6D28D9]" />
                      Format:
                    </span>
                    <span className="font-semibold text-[#211536]">{service.format}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#211536]/60">
                      <Clock className="w-3.5 h-3.5 text-[#6D28D9]" />
                      Delivery Speed:
                    </span>
                    <span className="font-semibold text-emerald-600">{service.deliverySpeed || service.speed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#211536]/60">
                      <Zap className="w-3.5 h-3.5 text-[#6D28D9]" />
                      Stock:
                    </span>
                    <span className="font-semibold text-[#211536]">{service.stock || service.stockText}</span>
                  </div>
                </div>
              </div>

              {/* Price & Buy Now CTA */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-lg font-black text-[#211536]">
                    ₹{service.priceInr}
                  </div>
                  <div className="text-[11px] text-[#211536]/60 font-medium">
                    ${service.priceUsdt} USDT
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onBuyNow(service, 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs shadow-xs hover:shadow-sm transition-all"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy Now</span>
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* Empty Search State */}
        {filteredServices.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E5DCF4]">
            <Search className="w-8 h-8 text-[#211536]/30 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#211536] mb-1">No matching services found</h4>
            <p className="text-xs text-[#211536]/60">
              Try searching for &quot;Telegram&quot;, &quot;India&quot;, &quot;WhatsApp&quot; or clearing your filter chips.
            </p>
          </div>
        )}

      </div>
    </section>
  );
};
