import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CLOSURES_HEADING, CLOSURES_PATH, Closure, STATUS_LABELS, closureDatesText, currentClosures } from '../config/closures';
import { getClosures } from '../services/closures';
import { SpaLink, navigateTo } from './SpaLink';

/** Closures in force right now, most important first. Empty until loaded, and if there are none. */
export function useCurrentClosures(): Closure[] {
  const [list, setList] = useState<Closure[]>([]);
  useEffect(() => {
    let mounted = true;
    getClosures().then((d) => mounted && setList(currentClosures(d.closures)));
    return () => {
      mounted = false;
    };
  }, []);
  return list;
}

/** Homepage: yellow panel with the top three current closures and a link to the closures page. */
export const ClosuresPromo: React.FC = () => {
  const top = useCurrentClosures().slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="closures-promo-heading" className="bg-brand text-brand-ink p-4 sm:p-6">
      <div className="lg:flex lg:items-start lg:gap-8">
        <div className="lg:w-1/3 shrink-0">
          <h2 id="closures-promo-heading" className="font-display font-extrabold text-2xl sm:text-3xl leading-[1.1]">
            {CLOSURES_HEADING}
          </h2>
          <SpaLink
            href={CLOSURES_PATH}
            onNavigate={() => navigateTo(CLOSURES_PATH)}
            className="mt-3 inline-flex items-center gap-2 h-11 px-4 bg-brand-ink text-white text-sm font-extrabold hover:bg-white hover:text-brand-ink"
          >
            See the map and every closure
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </SpaLink>
        </div>
        <ol className="mt-4 lg:mt-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-x-6 border-t-2 border-brand-ink md:border-t-0">
          {top.map((c, i) => (
            <li key={c.id} className="flex gap-3 py-3 border-b-2 md:border-b-0 md:border-t-2 border-brand-ink">
              <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 bg-brand-ink text-white font-headline font-extrabold" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{STATUS_LABELS[c.status]}</p>
                <p className="font-headline font-extrabold text-base leading-snug">{c.name}</p>
                <p className="text-sm">{closureDatesText(c)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

/** Thin "Live travel" line under the header: the most important current closure. Hidden when there is none. */
export const LiveTravelLine: React.FC = () => {
  const top = useCurrentClosures()[0];
  if (!top) return null;
  return (
    <div className="bg-brand text-brand-ink no-print">
      <SpaLink
        href={CLOSURES_PATH}
        onNavigate={() => navigateTo(CLOSURES_PATH)}
        className="max-w-7xl mx-auto px-3 sm:px-6 min-h-11 flex items-center gap-2 text-sm"
      >
        <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.08em] bg-brand-ink text-white px-2 py-1 leading-none">
          Live travel
        </span>
        <span className="min-w-0 truncate">
          <strong>
            {STATUS_LABELS[top.status]}: {top.name}
          </strong>
          <span className="max-sm:hidden"> · {closureDatesText(top)}</span>
        </span>
        <ArrowRight className="w-4 h-4 shrink-0 ml-auto" aria-hidden="true" />
      </SpaLink>
    </div>
  );
};
