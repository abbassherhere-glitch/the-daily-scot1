import React from 'react';
import { HOUSE_AD } from '../config/ads';

interface AdBannerProps {
  type: 'leaderboard' | 'mpu' | 'mobile';
  className?: string;
}

// Advertiser brand colours (Mondus Pro)
const AD_BG = '#1E252B';
const AD_ACCENT = '#7EC8E3';
const AD_GRADIENT = 'linear-gradient(90deg, #7EC8E3 0%, #5DD3A6 50%, #E2C15A 100%)';

const Label: React.FC<{ small?: boolean }> = ({ small }) => (
  <div
    className={`${small ? 'text-[10px] mb-1.5' : 'text-[11px] mb-2.5'} flex items-center justify-between uppercase font-semibold tracking-wider text-ink-muted`}
  >
    <span>Advertisement</span>
    <span className="normal-case tracking-normal font-medium opacity-80">Sponsored</span>
  </div>
);

/** Ad slots sit in the same rounded card as the rest of the page, so they never look bolted on. */
const AdCard: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <aside
    aria-label="Advertisement"
    className={`w-full rounded-2xl border border-line bg-surface shadow-card p-3 sm:p-4 no-print ${className}`}
  >
    {children}
  </aside>
);

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <span
    aria-hidden="true"
    className="inline-flex flex-col justify-center gap-[2px] rounded-full overflow-hidden shrink-0"
    style={{ width: size, height: size }}
  >
    {[0, 1, 2, 3].map((i) => (
      <span key={i} className="block h-[3px] w-full rounded-full" style={{ background: AD_GRADIENT, opacity: 1 - i * 0.15 }} />
    ))}
  </span>
);

const Wordmark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
    <Mark size={size === 'sm' ? 16 : 22} />
    <span className={`font-bold text-white tracking-tight ${size === 'sm' ? 'text-[13px]' : 'text-base'}`}>
      {HOUSE_AD.advertiser}
    </span>
  </span>
);

const linkProps = {
  href: HOUSE_AD.url,
  target: '_blank',
  rel: 'sponsored noopener',
  'aria-label': `${HOUSE_AD.advertiser} (advertisement): ${HOUSE_AD.headline}`,
};

export const AdBanner: React.FC<AdBannerProps> = ({ type, className = '' }) => {
  if (type === 'mpu') {
    return (
      <AdCard className={`max-w-[340px] mx-auto my-4 ${className}`}>
        <Label />
        <a
          {...linkProps}
          className="group block w-full max-w-[300px] h-[250px] mx-auto text-left p-5 flex flex-col justify-between rounded-xl overflow-hidden ring-1 ring-black/5 hover:brightness-110 transition"
          style={{ background: AD_BG }}
        >
          <Wordmark />
          <div>
            <p className="text-white font-bold text-[19px] leading-tight">On-site IT engineers, when you need them.</p>
            <p className="text-neutral-300 text-[12px] leading-snug mt-2">{HOUSE_AD.body}</p>
          </div>
          <div className="flex items-end justify-between gap-2">
            <ul className="text-[10px] text-neutral-400 space-y-0.5">
              {HOUSE_AD.points.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
            <span
              className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full group-hover:brightness-110"
              style={{ background: AD_ACCENT, color: AD_BG }}
            >
              {HOUSE_AD.cta} →
            </span>
          </div>
        </a>
      </AdCard>
    );
  }

  if (type === 'mobile') {
    return (
      <AdCard className={`max-w-[352px] mx-auto my-3 p-2.5! ${className}`}>
        <Label small />
        <a
          {...linkProps}
          className="flex w-full max-w-[320px] h-[50px] mx-auto items-center justify-between gap-2 px-3 rounded-lg overflow-hidden"
          style={{ background: AD_BG }}
        >
          <Wordmark size="sm" />
          <span className="text-[11px] text-neutral-200 truncate">{HOUSE_AD.shortLine}</span>
          <span className="text-[13px] font-bold" style={{ color: AD_ACCENT }} aria-hidden="true">→</span>
        </a>
      </AdCard>
    );
  }

  // Standard 728x90 Leaderboard (responsive on smaller screens)
  return (
    <AdCard className={`my-4 ${className}`}>
      <div className="max-w-[728px] mx-auto">
      <Label />
      <a
        {...linkProps}
        className="group relative flex w-full min-h-[90px] items-center justify-between gap-4 px-4 sm:px-6 py-3 text-left rounded-xl overflow-hidden hover:brightness-110 transition"
        style={{ background: AD_BG }}
      >
        <span className="absolute left-0 top-0 h-[3px] w-full" style={{ background: AD_GRADIENT }} aria-hidden="true" />
        <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5 min-w-0">
          <Wordmark />
          <span className="text-white font-semibold text-[13px] sm:text-[15px] leading-snug">{HOUSE_AD.headline}</span>
        </span>
        <span
          className="shrink-0 text-[11px] sm:text-xs font-bold px-3.5 py-2 rounded-full group-hover:brightness-110"
          style={{ background: AD_ACCENT, color: AD_BG }}
        >
          {HOUSE_AD.cta} →
        </span>
      </a>
      </div>
    </AdCard>
  );
};
