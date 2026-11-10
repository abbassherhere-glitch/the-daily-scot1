import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard } from '../components/ArticleCard';
import { BlockLabel } from '../components/BlockLabel';
import { ClosureMap, MapLine, MapPin } from '../components/ClosureMap';
import { NewsletterBox } from '../components/NewsletterBox';
import { SpaLink } from '../components/SpaLink';
import {
  CLOSURES_HEADING,
  CLOSURES_INTRO,
  CLOSURE_FILTERS,
  Closure,
  ClosureFilter,
  KIND_LABELS,
  STATUS_LABELS,
  closureDatesText,
  matchesFilter,
} from '../config/closures';
import { formatUkDateTime } from '../config/updates';
import { ClosuresData, getClosures, transportStoryToArticle } from '../services/closures';

interface ClosuresPageProps {
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
}

const statusTone = (c: Closure) => (c.status === 'reopened' ? 'area-inv' : c.status === 'planned' ? 'section' : 'alert');

/**
 * /glasgow-road-closures: yellow banner, filter buttons, a street map with numbered pins beside a matching
 * numbered list, then the Morning Briefing sign-up and the latest transport stories. The server-rendered
 * version of the page (functions/utils/closuresPage.ts) lists the same closures in the same order.
 */
const ClosuresPage: React.FC<ClosuresPageProps> = ({ onSelectArticle, onSelectCategory }) => {
  const [data, setData] = useState<ClosuresData | null>(null);
  const [filter, setFilter] = useState<ClosureFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    let mounted = true;
    getClosures().then((d) => mounted && setData(d));
    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(() => (data?.closures || []).filter((c) => matchesFilter(c, filter)), [data, filter]);

  // Pin numbers are the item numbers in the list as it is shown right now
  const pins: MapPin[] = useMemo(
    () =>
      visible.flatMap((c, i) =>
        c.latitude !== null && c.longitude !== null
          ? [{ id: c.id, number: i + 1, lng: c.longitude, lat: c.latitude, label: `${i + 1}. ${c.name}: ${STATUS_LABELS[c.status]}` }]
          : [],
      ),
    [visible],
  );
  // Lines are drawn for the selected closure only, so the map stays readable
  const lines: MapLine[] = useMemo(() => {
    const c = visible.find((v) => v.id === selectedId);
    if (!c) return [];
    return [
      ...(c.diversionLine ? [{ id: `${c.id}-diversion`, kind: 'diversion' as const, points: c.diversionLine }] : []),
      ...(c.closureLine ? [{ id: `${c.id}-closed`, kind: 'closed' as const, points: c.closureLine }] : []),
    ];
  }, [visible, selectedId]);

  const selectFromMap = (id: string) => {
    setSelectedId(id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    itemRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };

  const stories = (data?.stories || []).map(transportStoryToArticle);

  return (
    <div>
      {/* Yellow banner */}
      <div className="bg-brand text-brand-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center gap-2 text-xs uppercase font-extrabold tracking-wider">
              <li>
                <SpaLink
                  href="/"
                  onNavigate={() => onSelectCategory('all')}
                  className="inline-flex items-center min-h-11 underline decoration-2 underline-offset-4 hover:decoration-4"
                >
                  Home
                </SpaLink>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Road closures</li>
            </ol>
          </nav>
          <h1 className="font-display font-extrabold text-[32px] leading-[1.05] sm:text-5xl lg:text-6xl text-balance">
            {CLOSURES_HEADING}
          </h1>
          <p className="mt-3 text-sm sm:text-base font-bold" aria-live="polite">
            {data?.updatedAt ? (
              <>
                Last updated: <time dateTime={data.updatedAt}>{formatUkDateTime(data.updatedAt)}</time>
              </>
            ) : data ? (
              'No closures have been listed yet.'
            ) : (
              'Loading the latest closures…'
            )}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <p className="text-base sm:text-lg text-ink-soft max-w-3xl">{CLOSURES_INTRO}</p>

        {/* Filter buttons */}
        <div role="group" aria-label="Show closures" className="flex flex-wrap gap-2">
          {CLOSURE_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFilter(f.id);
                  setSelectedId(null);
                }}
                className={`inline-flex items-center h-11 px-4 border-2 border-ink text-sm font-extrabold ${
                  active ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-brand'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Map beside the numbered list */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 lg:sticky lg:top-20 lg:self-start">
            <ClosureMap
              pins={pins}
              lines={lines}
              selectedId={selectedId}
              onSelect={selectFromMap}
              label="Map of Glasgow road closures. Every closure is also in the numbered list."
              heightClassName="h-[340px] sm:h-[460px] lg:h-[600px]"
              legend
            />
          </div>

          <div className="lg:col-span-5">
            <p className="text-sm font-bold text-ink mb-2" role="status">
              {data ? `${visible.length} ${visible.length === 1 ? 'closure' : 'closures'} shown` : 'Loading…'}
            </p>
            {data && visible.length === 0 ? (
              <p className="border-2 border-ink bg-surface p-4 text-base">
                {data.closures.length === 0
                  ? 'There are no road closures listed at the moment.'
                  : 'No closures match this filter at the moment.'}
              </p>
            ) : (
              <ol className="border-t-[3px] border-ink">
                {visible.map((c, i) => {
                  const selected = c.id === selectedId;
                  const onMap = c.latitude !== null && c.longitude !== null;
                  return (
                    <li
                      key={c.id}
                      id={`closure-${c.id}`}
                      ref={(el) => {
                        if (el) itemRefs.current.set(c.id, el);
                        else itemRefs.current.delete(c.id);
                      }}
                      className={`relative flex gap-3 p-3 sm:p-4 border-b border-line scroll-mt-24 ${selected ? 'bg-brand' : ''}`}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 font-headline font-extrabold text-xl ${
                          selected ? 'bg-brand-ink text-brand' : 'bg-brand-ink text-white'
                        }`}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap gap-1.5 mb-2">
                          <BlockLabel
                            tone={statusTone(c)}
                            className={c.status === 'reopened' ? 'outline outline-1 outline-ink' : c.status === 'planned' && selected ? 'bg-white!' : ''}
                          >
                            {STATUS_LABELS[c.status]}
                          </BlockLabel>
                          <BlockLabel tone="area">{KIND_LABELS[c.kind]}</BlockLabel>
                        </p>
                        <h2 className="font-headline font-extrabold text-xl leading-tight text-ink">
                          <span className="sr-only">{i + 1}. </span>
                          {onMap ? (
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelectedId(selected ? null : c.id)}
                              className="text-left hover:underline decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-['']"
                            >
                              {c.name}
                              <span className="sr-only">{selected ? ' (shown on the map)' : ' (show on the map)'}</span>
                            </button>
                          ) : (
                            c.name
                          )}
                        </h2>
                        {c.area && <p className="text-sm font-bold text-ink-soft mt-0.5">{c.area}</p>}
                        <p className="mt-2 text-[15px] font-bold text-ink">{closureDatesText(c)}</p>
                        {c.reason && <p className="mt-1 text-[15px] text-ink-soft">{c.reason}</p>}
                        {c.diversion && (
                          <p className="mt-1 text-[15px] text-ink-soft">
                            <strong className="text-ink">Diversion:</strong> {c.diversion}
                          </p>
                        )}
                        {c.storySlug && (
                          <p className="mt-1">
                            <SpaLink
                              href={`/news/${encodeURIComponent(c.storySlug)}`}
                              onNavigate={() =>
                                onSelectArticle(
                                  transportStoryToArticle({ id: c.storySlug!, slug: c.storySlug!, title: c.storyTitle || c.name, category: 'news' }),
                                )
                              }
                              className="relative z-10 inline-flex items-center min-h-11 text-[15px] font-extrabold text-ink underline decoration-2 underline-offset-4 hover:decoration-4"
                            >
                              Full story: {c.storyTitle || c.name}
                            </SpaLink>
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Morning Briefing sign-up */}
        <div className="max-w-2xl">
          <NewsletterBox className="p-6!" />
        </div>

        {/* Latest transport stories */}
        {stories.length > 0 && (
          <section aria-labelledby="transport-stories-heading">
            <div className="border-b-[3px] border-ink mb-5">
              <h2
                id="transport-stories-heading"
                className="inline-block bg-brand text-brand-ink px-3 py-1.5 font-headline font-extrabold text-xl uppercase"
              >
                Latest transport stories
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {stories.map((story) => (
                <ArticleCard key={story.id} article={story} variant="grid-card" onSelect={onSelectArticle} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ClosuresPage;
