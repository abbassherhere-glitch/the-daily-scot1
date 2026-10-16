import React from 'react';

interface AdBannerProps {
  type: 'leaderboard' | 'mpu' | 'mobile';
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ type, className = '' }) => {
  if (type === 'mpu') {
    return (
      <div className={`w-full max-w-[300px] mx-auto my-4 text-center no-print ${className}`}>
        <div className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 mb-1">
          Advertisement
        </div>
        <div className="w-full max-w-[300px] h-[250px] mx-auto bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center text-neutral-600">
          <span className="text-xs font-semibold tracking-wider uppercase text-neutral-600">
            300 × 250 MPU
          </span>
          <span className="text-[10px] text-neutral-600 mt-1">
            Display Advertising
          </span>
        </div>
      </div>
    );
  }

  if (type === 'mobile') {
    return (
      <div className={`w-full max-w-[320px] mx-auto my-3 text-center no-print ${className}`}>
        <div className="text-[9px] uppercase font-semibold tracking-wider text-neutral-600 mb-0.5">
          Advertisement
        </div>
        <div className="w-full max-w-[320px] h-[50px] mx-auto bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 text-[11px] font-semibold">
          320 × 50 Mobile Banner
        </div>
      </div>
    );
  }

  // Standard 728x90 Leaderboard (Responsive on smaller screens)
  return (
    <div className={`w-full max-w-[728px] mx-auto my-4 text-center no-print ${className}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 mb-1">
        Advertisement
      </div>
      <div className="w-full h-[90px] bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center text-neutral-600">
        <span className="text-xs font-semibold tracking-wider uppercase text-neutral-600">
          728 × 90 Leaderboard
        </span>
        <span className="text-[10px] text-neutral-600 mt-0.5 hidden sm:inline">
          Standard Regional Display Slot
        </span>
      </div>
    </div>
  );
};
