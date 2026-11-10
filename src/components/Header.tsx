import React, { useState, useEffect } from 'react';
import { Search, X, Pause, Play } from 'lucide-react';
import { SpaLink, categoryHref, navigateTo } from './SpaLink';
import { CategoryType, Article } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { Dialog } from './Dialog';
import { NewsletterBox } from './NewsletterBox';
import { Logo } from './Logo';
import { BlockLabel } from './BlockLabel';
import { LiveTravelLine } from './ClosuresPromo';

interface HeaderProps {
  currentCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
  onOpenSearch: () => void;
  onOpenSaved: () => void;
  onSelectArticle: (article: Article) => void;
  savedCount: number;
}

interface BreakingArticle {
  id: string;
  slug: string;
  title: string;
  standfirst?: string;
  category: string;
  area?: string;
  published_at?: string;
  breaking_until?: string;
}

const CONTACT_PATH = '/contact';

// The ticker only has headline data; App loads the full story when a stub is opened.
function toStub(art: BreakingArticle): Article {
  return {
    id: art.id,
    slug: art.slug,
    title: art.title,
    standfirst: art.standfirst || '',
    category: art.category as CategoryType,
    publishedAt: art.published_at || new Date().toISOString(),
    content: [],
    tags: [],
    author: { name: 'The Daily Scot Staff', role: 'The Daily Scot Newsdesk', avatar: '' },
    heroImage: '',
    heroCaption: '',
    heroCredit: '',
    readTime: '',
    views: 0,
    comments: [],
    isPartial: true,
  };
}

const NAV_LINK =
  'inline-flex items-center min-h-11 px-2.5 sm:px-3 border-b-4 text-[13px] font-bold uppercase tracking-wide whitespace-nowrap text-white';

export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  onOpenSearch,
  onSelectArticle,
}) => {
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [breakingNews, setBreakingNews] = useState<BreakingArticle[]>([]);
  // The marquee pauses on hover/focus (CSS) and stays paused if the reader presses Pause (WCAG 2.2.2)
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 1. Breaking news (re-fetched every 60 seconds)
  useEffect(() => {
    let mounted = true;
    const fetchBreaking = async () => {
      try {
        const res = await fetch('/api/breaking');
        if (res.ok) {
          const data = (await res.json()) as { articles: BreakingArticle[] };
          if (mounted && data?.articles) setBreakingNews(data.articles);
        }
      } catch {
        // offline: keep whatever we had
      }
    };

    fetchBreaking();
    const tickerInterval = setInterval(fetchBreaking, 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(tickerInterval);
    };
  }, []);

  // 2. Motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Read the address on every render (the app re-renders the header on each navigation); the listener covers
  // navigation that happens without the app's state changing.
  const [, setPathTick] = useState(0);
  useEffect(() => {
    const sync = () => setPathTick((n) => n + 1);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const onContactPage = path === CONTACT_PATH;

  const isActive = (slug: string) => (slug === 'home' ? path === '/' : path.startsWith('/news/') && currentCategory === slug);

  const handleSectionClick = (slug: string) => {
    onSelectCategory(slug === 'home' ? 'all' : (slug as CategoryType));
  };

  const animateTicker = !prefersReducedMotion && breakingNews.length > 0;
  const tickerDuration = `${Math.max(30, breakingNews.length * 14)}s`;

  const breakingLink = (art: BreakingArticle, hidden = false) => (
    <SpaLink
      href={`/news/${encodeURIComponent(art.slug)}`}
      onNavigate={() => onSelectArticle(toStub(art))}
      tabIndex={hidden ? -1 : undefined}
      className="inline-flex items-center min-h-11 text-sm font-bold text-ink hover:underline underline-offset-4 whitespace-nowrap"
    >
      {art.title}
    </SpaLink>
  );

  return (
    <>
      {/* 1. BLACK BAR: logo, search and the Morning Briefing button. Stays at the top while reading. */}
      <header className="on-dark sticky top-0 z-40 w-full bg-brand-ink text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <SpaLink href="/" onNavigate={() => onSelectCategory('all')} className="flex items-center select-none shrink-0">
            <Logo variant="horizontal" className="h-8 sm:h-10 w-auto" />
            <span className="sr-only">{SITE_CONFIG.name} – homepage</span>
          </SpaLink>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center justify-center gap-2 min-w-11 h-11 px-2 sm:px-3 text-sm font-bold text-white hover:underline underline-offset-4"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
              <span className="max-sm:sr-only">Search</span>
            </button>
            <button
              type="button"
              onClick={() => setSubscribeOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex items-center h-11 px-3 sm:px-4 bg-brand text-brand-ink text-[13px] sm:text-sm font-extrabold whitespace-nowrap hover:bg-white"
            >
              <span className="max-[359px]:hidden">Morning&nbsp;</span>Briefing
            </button>
          </div>
        </div>
      </header>

      {/* 2. SECTION LINKS: white on black, wrapping onto as many rows as the screen needs. */}
      <nav aria-label="Sections" className="on-dark w-full bg-brand-ink border-t border-white/25">
        <ul className="max-w-7xl mx-auto px-0.5 sm:px-3 flex flex-wrap">
          {SITE_CONFIG.sections.map((sec) => {
            const active = isActive(sec.slug);
            return (
              <li key={sec.slug}>
                <SpaLink
                  href={categoryHref(sec.slug)}
                  onNavigate={() => handleSectionClick(sec.slug)}
                  aria-current={active ? 'page' : undefined}
                  className={`${NAV_LINK} ${active ? 'border-brand' : 'border-transparent hover:border-white/60'}`}
                >
                  {sec.label}
                </SpaLink>
              </li>
            );
          })}
          <li>
            <SpaLink
              href={CONTACT_PATH}
              onNavigate={() => navigateTo(CONTACT_PATH)}
              aria-current={onContactPage ? 'page' : undefined}
              className={`${NAV_LINK} ${onContactPage ? 'border-brand' : 'border-transparent hover:border-white/60'}`}
            >
              Contact Us
            </SpaLink>
          </li>
        </ul>
      </nav>

      {/* Live travel: the most important current road closure (hidden when there is none) */}
      <LiveTravelLine />

      {/* 3. BREAKING NEWS BAR (hidden when nothing is breaking) */}
      {/* Not a live region: moving headlines would interrupt screen readers constantly. */}
      {breakingNews.length > 0 && (
        <section aria-label="Breaking news" className="bg-surface border-b-2 border-ink no-print">
          <div className="max-w-7xl mx-auto pl-3 sm:pl-6 flex items-center gap-3">
            <BlockLabel tone="alert" className="shrink-0">
              Breaking
            </BlockLabel>

            {animateTicker ? (
              <div
                className="ds-marquee-host flex-1 min-w-0 flex overflow-hidden"
                data-paused={isUserPaused ? 'true' : 'false'}
                style={{ ['--ds-marquee-duration' as string]: tickerDuration }}
              >
                {[0, 1].map((copy) => (
                  <ul
                    key={copy}
                    aria-hidden={copy === 1 ? true : undefined}
                    className="ds-marquee shrink-0 min-w-full flex items-center justify-around gap-10 pr-10"
                  >
                    {breakingNews.map((art) => (
                      <li key={`${copy}-${art.id}`} className="flex items-center gap-10">
                        {breakingLink(art, copy === 1)}
                        <span className="w-1.5 h-1.5 bg-ink" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            ) : (
              <ul className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto scrollbar-none pr-3">
                {breakingNews.map((art) => (
                  <li key={art.id} className="shrink-0">
                    {breakingLink(art)}
                  </li>
                ))}
              </ul>
            )}

            {animateTicker && (
              <button
                type="button"
                onClick={() => setIsUserPaused((v) => !v)}
                aria-pressed={isUserPaused}
                aria-label={isUserPaused ? 'Resume moving breaking headlines' : 'Pause moving breaking headlines'}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 border-l border-line text-ink hover:bg-surface-2"
              >
                {isUserPaused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Morning Briefing sign-up */}
      <Dialog
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        title="Sign up for the Morning Briefing"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        className="on-dark relative w-full max-w-md border-2 border-brand"
      >
        <button
          type="button"
          onClick={() => setSubscribeOpen(false)}
          aria-label="Close"
          className="absolute top-0 right-0 z-10 inline-flex items-center justify-center w-11 h-11 text-white hover:bg-white hover:text-brand-ink"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <NewsletterBox className="p-6! pt-10!" />
      </Dialog>
    </>
  );
};
