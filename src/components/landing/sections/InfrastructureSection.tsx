import React from 'react';
import { Server, Database, Smartphone, TrendingUp, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { INFRASTRUCTURE_SERVERS } from '../data/landingData';

interface InfrastructureSectionProps {
  onExploreServer: (serverId: number) => void;
}

export const InfrastructureSection: React.FC<InfrastructureSectionProps> = ({ onExploreServer }) => {
  const getIcon = (id: number) => {
    switch (id) {
      case 1:
        return Server;
      case 2:
        return Database;
      case 3:
        return Smartphone;
      default:
        return TrendingUp;
    }
  };

  return (
    <section id="infrastructure" className="py-16 sm:py-24 bg-white border-b border-[#E5DCF4] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#211536] tracking-tight mb-4">
            Built on 4 Specialized Enterprise Server Pipelines
          </h2>
          <p className="text-sm sm:text-base text-[#211536]/70 leading-relaxed">
            Unlike simple single-provider wrappers, our platform routes traffic across four dedicated fulfillment clusters engineered for high-concurrency verification and marketing automations.
          </p>
        </div>

        {/* 4 Servers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {INFRASTRUCTURE_SERVERS.map((srv) => {
            const Icon = getIcon(srv.id);

            return (
              <div
                key={srv.id}
                className="bg-[#FAF8FF] rounded-2xl p-7 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  {/* Server Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#6D28D9] shadow-sm group-hover:bg-[#6D28D9] group-hover:text-white transition-all">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#211536] leading-tight">
                          {srv.title}
                        </h3>
                        <span className="text-xs text-[#211536]/60 font-medium">
                          {srv.tagline}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${srv.badgeColor}`}
                    >
                      {srv.badge}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-[#211536]/75 leading-relaxed mb-5">
                    {srv.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-2 mb-6">
                    {srv.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[#211536]/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#6D28D9] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-white border border-[#E5DCF4]/80 text-xs mb-6">
                    {srv.specs.map((spec, i) => (
                      <div key={i}>
                        <span className="text-[11px] text-[#211536]/50 block font-medium">
                          {spec.label}
                        </span>
                        <span className="font-bold text-[#211536]">{spec.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-[#E5DCF4]/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Automated Warranty &amp; Refund</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onExploreServer(srv.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#6D28D9] hover:text-[#5B21B6] group-hover:translate-x-0.5 transition-all"
                  >
                    <span>View Server Stock</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
