import React from 'react';

interface SkeletonListProps {
  count?: number;
}

/**
 * Shimmer Glass Skeleton Card for Server 1 (LZT Accounts) and Server 2 (Aged Sessions)
 */
export const Server1SkeletonList: React.FC<SkeletonListProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-2.5 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`s1_skel_${idx}`}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820]/70 border border-[#262630]/60 backdrop-blur-md animate-pulse select-none"
        >
          {/* Left: Flag Icon + Titles */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-28 bg-white/10 rounded-md" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-white/5 rounded-md" />
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <div className="h-3 w-20 bg-emerald-500/10 rounded-md" />
              </div>
            </div>
          </div>

          {/* Right: Price + Buy Button */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-4 w-12 bg-emerald-500/15 rounded-md" />
            <div className="h-7 w-16 bg-[#7c3aed]/20 border border-[#7c3aed]/30 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Shimmer Glass Skeleton Card for Server 3 & 4 (Virtual / Fresh SMS OTP Services)
 */
export const Server34SkeletonList: React.FC<SkeletonListProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-2.5 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`s34_skel_${idx}`}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181820]/70 border border-[#262630]/60 backdrop-blur-md animate-pulse select-none"
        >
          {/* Left: Service Icon + Platform Name + Badges */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-32 bg-white/10 rounded-md" />
                <div className="h-3.5 w-14 bg-white/5 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-20 bg-emerald-500/10 rounded-md" />
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <div className="h-3 w-14 bg-white/5 rounded-md" />
              </div>
            </div>
          </div>

          {/* Right: Price + Action Button */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-4 w-10 bg-emerald-500/15 rounded-md" />
            <div className="h-7 w-20 bg-[#7c3aed]/20 border border-[#7c3aed]/30 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Shimmer Glass Skeleton Card for Server 5 (SMM Social Media Packages)
 */
export const Server5SkeletonList: React.FC<SkeletonListProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-2.5 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`s5_skel_${idx}`}
          className="flex flex-col gap-3 p-3.5 rounded-2xl bg-[#181820]/70 border border-[#262630]/60 backdrop-blur-md animate-pulse select-none"
        >
          {/* Top Row: Icon + Title + Price */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 shrink-0" />
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-44 bg-white/10 rounded-md" />
                <div className="h-3.5 w-24 bg-emerald-500/10 rounded-md" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="h-4 w-14 bg-emerald-500/15 rounded-md" />
              <div className="h-2.5 w-10 bg-white/5 rounded-md" />
            </div>
          </div>

          {/* Description line placeholder */}
          <div className="h-3 w-4/5 bg-white/5 rounded-md" />

          {/* Bottom Row: Speed Tag + Button */}
          <div className="flex items-center justify-between pt-1 border-t border-[#262630]/40">
            <div className="h-3 w-28 bg-white/5 rounded-md" />
            <div className="h-7 w-28 bg-[#7c3aed]/20 border border-[#7c3aed]/30 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};
