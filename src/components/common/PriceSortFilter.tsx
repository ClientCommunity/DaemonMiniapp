import React from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';

export type PriceSortOrder = 'default' | 'asc' | 'desc';

interface PriceSortFilterProps {
  value: PriceSortOrder;
  onChange: (val: PriceSortOrder) => void;
  className?: string;
}

/**
 * Reusable Price Sort Filter control for store servers.
 * Allows customers to sort catalogue items by:
 * - Default server ranking
 * - Price: Low to High
 * - Price: High to Low
 */
export const PriceSortFilter: React.FC<PriceSortFilterProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const isFiltered = value !== 'default';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PriceSortOrder)}
        aria-label="Filter and sort by price"
        className={`appearance-none rounded-xl pl-7 pr-6 py-2.5 text-[11px] sm:text-xs font-semibold focus:outline-none transition-all cursor-pointer shadow-inner border ${
          isFiltered
            ? 'bg-[#7c3aed]/15 border-[#7c3aed] text-white shadow-violet-glow-sm/20'
            : 'bg-[#181820] border-[#262630] hover:border-[#38384a] text-[#a1a1aa] hover:text-white'
        }`}
      >
        <option value="default" className="bg-[#181820] text-white">
          Sort: Default
        </option>
        <option value="asc" className="bg-[#181820] text-white">
          Price: Low to High ↑
        </option>
        <option value="desc" className="bg-[#181820] text-white">
          Price: High to Low ↓
        </option>
      </select>
      <ArrowUpDown
        className={`w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
          isFiltered ? 'text-[#a78bfa]' : 'text-[#71717a]'
        }`}
      />
      <ChevronDown
        className={`w-3.5 h-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
          isFiltered ? 'text-[#a78bfa]' : 'text-[#71717a]'
        }`}
      />
    </div>
  );
};

export default PriceSortFilter;
