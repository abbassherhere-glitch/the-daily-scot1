import React from 'react';
import {
  Closure,
  STATUS_LABELS,
  StoryPin,
  closureProgress,
  closureProgressText,
  formatClosureDateTime,
} from '../config/closures';
import { CLOSURES_PATH } from '../config/closures';
import { ClosureMap, MapLine, MapPin } from './ClosureMap';
import { BlockLabel } from './BlockLabel';
import { SpaLink, navigateTo } from './SpaLink';

/**
 * Black "closure dates" bar on a story linked to a road closure: start and end times in yellow, and a
 * progress bar that fills day by day ("Day 3 of 18").
 */
export const ClosureDatesBar: React.FC<{ closure: Closure }> = ({ closure }) => {
  const progress = closureProgress(closure);
  const progressText = closureProgressText(closure);
  const start = formatClosureDateTime(closure.startsAt);
  const end = formatClosureDateTime(closure.endsAt);

  return (
    <section aria-label="Closure dates" className="on-dark max-w-[680px] bg-brand-ink text-white p-4 sm:p-5">
      <p className="flex flex-wrap items-center gap-2 mb-3">
        <BlockLabel>Closure dates</BlockLabel>
        <BlockLabel tone={closure.status === 'reopened' ? 'area-inv' : closure.status === 'planned' ? 'area-inv' : 'alert'}>
          {STATUS_LABELS[closure.status]}
        </BlockLabel>
      </p>
      <p className="font-headline font-extrabold text-lg leading-snug mb-3">{closure.name}</p>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-neutral-300">Starts</dt>
          <dd className="font-headline font-extrabold text-lg sm:text-xl leading-tight text-brand">{start || 'To be confirmed'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-neutral-300">Ends</dt>
          <dd className="font-headline font-extrabold text-lg sm:text-xl leading-tight text-brand">{end || 'Until further notice'}</dd>
        </div>
      </dl>
      {progress && closure.status !== 'reopened' && (
        <div
          className="mt-4 h-3 bg-white/25"
          role="progressbar"
          aria-label="How far through the closure we are"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.day}
          aria-valuetext={progressText}
        >
          <div className="h-full bg-brand" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
      {progressText && <p className="mt-2 text-sm font-bold">{progressText}</p>}
      {closure.diversion && (
        <p className="mt-3 text-sm text-neutral-200">
          <strong className="text-white">Diversion:</strong> {closure.diversion}
        </p>
      )}
      <p className="mt-2">
        <SpaLink
          href={CLOSURES_PATH}
          onNavigate={() => navigateTo(CLOSURES_PATH)}
          className="inline-flex items-center min-h-11 text-sm font-extrabold text-brand underline decoration-2 underline-offset-4 hover:decoration-4"
        >
          All Glasgow road closures
        </SpaLink>
      </p>
    </section>
  );
};

/**
 * Small map on a story: the closed stretch in red and the diversion as a blue dashed line (with a key) when
 * the story is linked to a closure, and / or the story's own single pin. Draws nothing when there is no position.
 */
export const StoryMap: React.FC<{ closure?: Closure; pin?: StoryPin }> = ({ closure, pin }) => {
  const pins: MapPin[] = [];
  const lines: MapLine[] = [];

  if (closure) {
    if (closure.latitude !== null && closure.longitude !== null) {
      pins.push({ id: `closure-${closure.id}`, lng: closure.longitude, lat: closure.latitude, label: closure.name });
    }
    if (closure.diversionLine) lines.push({ id: 'diversion', kind: 'diversion', points: closure.diversionLine });
    if (closure.closureLine) lines.push({ id: 'closed', kind: 'closed', points: closure.closureLine });
  }
  if (pin) pins.push({ id: 'story-pin', lng: pin.longitude, lat: pin.latitude, label: pin.label || 'Location of this story' });

  if (pins.length === 0 && lines.length === 0) return null;

  const caption = pin?.label || (closure ? closure.name : '');
  return (
    <figure className="max-w-[680px]">
      <ClosureMap
        pins={pins}
        lines={lines}
        label={caption ? `Map: ${caption}` : 'Map for this story'}
        heightClassName="h-[260px] sm:h-[340px]"
        legend={lines.length > 0}
      />
      {caption && <figcaption className="mt-1 text-sm font-bold text-ink">{caption}</figcaption>}
    </figure>
  );
};
