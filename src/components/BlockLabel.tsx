import React from 'react';

/**
 * Small solid block label in capitals, used for sections, areas and "Breaking" everywhere on the site.
 *
 *   section   yellow block, black text
 *   area      black block, white text (on light backgrounds)
 *   area-inv  white block, black text (on black panels)
 *   alert     red block, white text
 */
export type BlockLabelTone = 'section' | 'area' | 'area-inv' | 'alert';

const TONES: Record<BlockLabelTone, string> = {
  section: 'bg-brand text-brand-ink',
  area: 'bg-ink text-page',
  'area-inv': 'bg-[#fff] text-brand-ink',
  alert: 'bg-alert text-white',
};

export const BLOCK_LABEL =
  'inline-block px-2 py-1 text-[11px] leading-none font-extrabold uppercase tracking-[0.08em] whitespace-nowrap';

export const BlockLabel: React.FC<{ tone?: BlockLabelTone; className?: string; children: React.ReactNode }> = ({
  tone = 'section',
  className = '',
  children,
}) => <span className={`${BLOCK_LABEL} ${TONES[tone]} ${className}`}>{children}</span>;

/** Section label plus, when the story has one, its area label. */
export const StoryLabels: React.FC<{
  section: string;
  area?: string;
  breaking?: boolean;
  onDark?: boolean;
  className?: string;
}> = ({ section, area, breaking, onDark, className = '' }) => (
  <p className={`flex flex-wrap items-center gap-1.5 ${className}`}>
    {breaking && <BlockLabel tone="alert">Breaking</BlockLabel>}
    <BlockLabel>{section}</BlockLabel>
    {area && area.toLowerCase() !== section.toLowerCase() && (
      <BlockLabel tone={onDark ? 'area-inv' : 'area'}>{area}</BlockLabel>
    )}
  </p>
);
