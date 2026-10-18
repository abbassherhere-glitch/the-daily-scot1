import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Flame, TrendingUp } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import { NewsletterBox } from '../components/NewsletterBox';
import { SpaLink, categoryHref } from '../components/SpaLink';

interface HomePageProps {
  articles: Article[];
  selectedArea?: string;
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
}

// ---------------------------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------------------------

const SectionHeading: React.FC<{
  title: string;
  accent: string;
  href?: string;
  linkLabel?: string;
  srLabel?: string;
  onNavigate?: () => void;
}> = ({ title, accent, href, linkLabel = 'See all', srLabel, onNavigate }) => (
  <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
    <div className="flex items-center gap-3 min-w-0">
      <span className={`w-1.5 h-7 rounded-full shrink-0 ${accent}`} aria-hidden="true" />
      <h2 className="font-display font-extrabold text-[22px] sm:text-2xl tracking-tight text-ink truncate">{title}</h2>
    </div>
    {href && onNavigate && (
      <SpaLink
        href={href}
        onNavigate={onNavigate}
        className="group/link shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10 transition"
      >
        <span>
          {linkLabel}
          {srLabel && <span className="sr-only"> {srLabel}</span>}
        </span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
      </SpaLink>
    )}
  </div>
);

type TabId = 'latest' | 'trending' | 'most-read';

const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'latest', label: 'Latest', icon: Clock },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'most-read', label: 'Most Read', icon: Flame },
];

/** Latest / Trending / Most Read in one compact card (WAI-ARIA tabs: arrow keys move between tabs). */
const StoryTabs: React.FC<{ lists: Record<TabId, Article[]>; onSelectArticle: (a: Article) => void }> = ({
  lists,
  onSelectArticle,
}) => {
  const [active, setActive] = useState<TabId>('latest');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = 'home-stories';

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    setActive(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-label="Story lists" className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div role="tablist" aria-label="Story lists" className="flex gap-1 p-1.5 m-3 mb-0 rounded-xl bg-surface-2">
        {TABS.map((tab, i) => {
          const selected = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-accent ${
                selected ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="px-4 sm:px-5 pb-2"
        >
          {lists[tab.id].length ? (
            <ol className="divide-y divide-line">
              {lists[tab.id].map((art, idx) => (
                <li key={art.id}>
                  <ArticleCard
                    article={art}
                    variant="thumb-left"
                    rank={tab.id === 'latest' ? undefined : idx + 1}
                    onSelect={onSelectArticle}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-ink-muted">No stories yet.</p>
          )}
        </div>
      ))}
    </section>
  );
};

const byNewest = (a: Article, b: Article) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

/** Views per hour since publication, damped so a big old story doesn't sit at the top for days. */
function trendingScore(a: Article): number {
  const hours = Math.max(0, (Date.now() - new Date(a.publishedAt).getTime()) / 3_600_000);
  return (a.views || 0) / Math.pow(hours + 2, 1.5);
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export const HomePage: React.FC<HomePageProps> = ({
  articles,
  selectedArea,
  onSelectArticle,
  onSelectCategory,
}) => {
  // Filter by selected area if any
  const filteredList = useMemo(() => {
    if (!selectedArea || selectedArea === 'All') return articles;
    return articles.filter(
      (a) =>
        a.locationTag?.toLowerCase() === selectedArea.toLowerCase() ||
        a.tags.some((t) => t.toLowerCase() === selectedArea.toLowerCase())
    );
  }, [articles, selectedArea]);

  const pool = filteredList.length >= 4 ? filteredList : articles;

  const layout = useMemo(() => {
    const used = new Set<string>();
    const take = (list: Article[], n: number) => {
      const out = list.filter((a) => !used.has(a.id)).slice(0, n);
      out.forEach((a) => used.add(a.id));
      return out;
    };

    // 1. Hero: the lead plus two secondary top stories (flagged top stories first)
    const lead = take(pool.filter((a) => a.isFeaturedLead).concat(pool), 1)[0];
    const secondary = take(pool.filter((a) => a.isTopStory).concat(pool), 2);

    // 2. Main feed
    const feed = take(pool, 6);

    // 3. Section blocks: stories not shown above first, topped up with the section's other stories
    //    so a block is never left half empty on a quiet news day.
    const section = (cats: string[], n: number) => {
      const inSection = pool.filter((a) => cats.includes(a.category));
      const fresh = take(inSection, n);
      const topUp = inSection.filter((a) => !fresh.includes(a)).slice(0, n - fresh.length);
      return [...fresh, ...topUp];
    };
    const glasgow = section(['glasgow', 'news'], 4);
    const sport = section(['sport'], 4);
    const property = section(['property', 'business'], 4);

    // 4. Tabbed lists draw from everything
    const latest = [...pool].sort(byNewest).slice(0, 5);
    const mostRead = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    const trendingRaw = [...pool].filter((a) => (a.views || 0) > 0).sort((a, b) => trendingScore(b) - trendingScore(a));
    const trending = (trendingRaw.length >= 3 ? trendingRaw : [...pool].sort(byNewest)).slice(0, 5);

    return { lead, secondary, feed, glasgow, sport, property, latest, mostRead, trending };
  }, [pool, articles]);

  const { lead, secondary, feed, glasgow, sport, property } = layout;
  const [sportLead, ...sportRest] = sport;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-4 space-y-10 sm:space-y-14">
      <h1 className="sr-only">The Daily Scot – latest news from Glasgow and Scotland</h1>

      {/* Area filter notice if active */}
      {selectedArea && selectedArea !== 'All' && (
        <div className="rounded-xl bg-accent/10 text-ink px-4 py-2.5 text-sm font-medium flex items-center justify-between">
          <span>Showing news for: {selectedArea}</span>
          <span className="text-ink-muted">{filteredList.length} stories</span>
        </div>
      )}

      {/* 1. HERO BENTO — lead story + two stacked secondary stories */}
      {lead && (
        <section aria-label="Top stories" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          <div className="lg:col-span-8">
            <ArticleCard article={lead} variant="lead" onSelect={onSelectArticle} />
          </div>
          {secondary.length > 0 && (
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-4 lg:gap-5">
              {secondary.map((art) => (
                <ArticleCard key={art.id} article={art} variant="overlay" onSelect={onSelectArticle} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. FEED + TABBED LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <section className="lg:col-span-8" aria-labelledby="home-latest-heading">
          <div className="flex items-center gap-3 mb-5 sm:mb-6">
            <span className="w-1.5 h-7 rounded-full bg-[#D92525] shrink-0" aria-hidden="true" />
            <h2 id="home-latest-heading" className="font-display font-extrabold text-[22px] sm:text-2xl tracking-tight text-ink">
              Today&rsquo;s stories
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {feed.map((art) => (
              <ArticleCard key={art.id} article={art} variant="grid-card" onSelect={onSelectArticle} />
            ))}
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6" aria-label="More stories">
          <StoryTabs
            lists={{ latest: layout.latest, trending: layout.trending, 'most-read': layout.mostRead }}
            onSelectArticle={onSelectArticle}
          />
          <div>
            <AdBanner type="mpu" className="my-0!" />
          </div>
        </aside>
      </div>

      {/* 3. LEADERBOARD */}
      <div>
        <AdBanner type="leaderboard" className="my-0!" />
      </div>

      {/* 4. GLASGOW */}
      {glasgow.length > 0 && (
        <section>
          <SectionHeading
            title="Glasgow"
            accent="bg-blue-600"
            href={categoryHref('glasgow')}
            srLabel="Glasgow news"
            onNavigate={() => onSelectCategory('glasgow')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {glasgow.map((art) => (
              <ArticleCard key={art.id} article={art} variant="grid-card" onSelect={onSelectArticle} />
            ))}
          </div>
        </section>
      )}

      {/* 5. SPORT — feature + list bento */}
      {sportLead && (
        <section>
          <SectionHeading
            title="Scottish Sport"
            accent="bg-teal-500"
            href={categoryHref('sport')}
            linkLabel="All sport"
            onNavigate={() => onSelectCategory('sport')}
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={sportRest.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <ArticleCard article={sportLead} variant="overlay" className="lg:min-h-[420px]" onSelect={onSelectArticle} />
            </div>
            {sportRest.length > 0 && (
              <div className="lg:col-span-5 rounded-2xl border border-line bg-surface shadow-card px-4 sm:px-5 py-1">
                <ul className="divide-y divide-line">
                  {sportRest.map((art) => (
                    <li key={art.id}>
                      <ArticleCard article={art} variant="thumb-left" onSelect={onSelectArticle} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. PROPERTY & BUSINESS + NEWSLETTER */}
      {property.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8">
            <SectionHeading
              title="Property & Business"
              accent="bg-amber-500"
              href={categoryHref('property')}
              linkLabel="More property"
              onNavigate={() => onSelectCategory('property')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {property.map((art) => (
                <ArticleCard key={art.id} article={art} variant="grid-card" onSelect={onSelectArticle} />
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 lg:pt-[60px]">
            <NewsletterBox className="rounded-2xl! p-6! shadow-card lg:sticky lg:top-24" />
          </div>
        </section>
      )}
    </div>
  );
};
