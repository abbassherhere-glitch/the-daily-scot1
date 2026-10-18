import React, { useState, useEffect } from 'react';
import { Search, Menu, X, Bookmark, Pause, Play, Sun, Moon, Mail, CloudSun } from 'lucide-react';
import { SpaLink, categoryHref } from './SpaLink';
import { CategoryType, Article } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { useTheme } from '../utils/theme';
import { Dialog } from './Dialog';
import { NewsletterBox } from './NewsletterBox';

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

/** Sections shown in the desktop bar (the logo is the way home; Opinion joins on very wide screens). */
const DESKTOP_SECTIONS = SITE_CONFIG.sections.filter((s) => s.slug !== 'home');

function weatherCodeToText(code: number): string {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55].includes(code)) return 'Drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([71, 73, 75].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Cloudy';
}

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

/** Saltire mark used beside the wordmark. */
const SaltireMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <rect width="32" height="32" rx="8" fill="#005EB8" />
    <path d="M7 7 L25 25 M25 7 L7 25" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
  </svg>
);

const ICON_BUTTON =
  'inline-flex items-center justify-center w-9 h-9 rounded-full text-ink-soft hover:text-ink hover:bg-surface-2 transition focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2';

export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  onOpenSearch,
  onOpenSaved,
  onSelectArticle,
  savedCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [weatherText, setWeatherText] = useState<string>('Glasgow');
  const [breakingNews, setBreakingNews] = useState<BreakingArticle[]>([]);
  // The marquee pauses on hover/focus (CSS) and stays paused if the reader presses Pause (WCAG 2.2.2)
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // 1. Live weather from Open-Meteo for the configured city
  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      try {
        const { latitude, longitude, name } = SITE_CONFIG.weatherLocation;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
        );
        if (!res.ok) throw new Error('Weather API error');
        const data = (await res.json()) as { current: { temperature_2m: number; weather_code: number } };
        if (mounted && data?.current) {
          const temp = Math.round(data.current.temperature_2m);
          const condition = weatherCodeToText(data.current.weather_code);
          setWeatherText(`${name} ${temp}°C · ${condition}`);
        }
      } catch {
        if (mounted) setWeatherText('Glasgow');
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Breaking news (re-fetched every 60 seconds)
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

  // 3. Motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isActive = (slug: string) => (slug === 'home' ? currentCategory === 'all' : currentCategory === slug);

  const handleSectionClick = (slug: string) => {
    onSelectCategory(slug === 'home' ? 'all' : (slug as CategoryType));
    setMobileMenuOpen(false);
  };

  const [namePrefix, nameLast] = (() => {
    const words = SITE_CONFIG.name.toUpperCase().split(' ');
    return [words.slice(0, -1).join(' '), words[words.length - 1]];
  })();

  const animateTicker = !prefersReducedMotion && breakingNews.length > 0;
  const tickerDuration = `${Math.max(30, breakingNews.length * 14)}s`;

  const breakingLink = (art: BreakingArticle, hidden = false) => (
    <SpaLink
      href={`/news/${encodeURIComponent(art.slug)}`}
      onNavigate={() => onSelectArticle(toStub(art))}
      tabIndex={hidden ? -1 : undefined}
      className="text-[13px] font-medium text-ink hover:text-accent hover:underline underline-offset-4 whitespace-nowrap"
    >
      {art.title}
    </SpaLink>
  );

  return (
    <>
      {/* 1. UTILITY LINE (scrolls away) */}
      <div className="bg-surface border-b border-line text-ink-muted text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:inline font-medium text-ink-soft">{dateStr}</span>
            <span className="hidden sm:inline text-line-strong" aria-hidden="true">
              •
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <CloudSun className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {weatherText}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSaved}
            className="flex items-center gap-1.5 font-medium hover:text-accent transition min-h-6 shrink-0"
            aria-haspopup="dialog"
          >
            <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Saved ({savedCount})</span>
          </button>
        </div>
      </div>

      {/* 2. STICKY GLASS HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-line bg-[var(--ds-header)] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-surface">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-3 lg:gap-6">
          <SpaLink
            href="/"
            onNavigate={() => onSelectCategory('all')}
            className="group flex items-center gap-2 sm:gap-2.5 select-none shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
          >
            <SaltireMark className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 transition-transform group-hover:rotate-6" />
            <span className="font-display text-[16px] sm:text-[20px] leading-none tracking-[-0.03em] text-ink whitespace-nowrap">
              <span className="font-semibold text-ink-soft">{namePrefix} </span>
              <span className="font-extrabold">{nameLast}</span>
            </span>
            <span className="sr-only">– homepage</span>
          </SpaLink>

          {/* Desktop sections */}
          <nav aria-label="Sections" className="hidden xl:flex flex-1 justify-center min-w-0">
            <ul className="flex items-center gap-0.5">
              {DESKTOP_SECTIONS.map((sec) => {
                const active = isActive(sec.slug);
                return (
                  <li key={sec.slug} className={sec.slug === 'opinion' ? 'hidden 2xl:block' : ''}>
                    <SpaLink
                      href={categoryHref(sec.slug)}
                      onNavigate={() => handleSectionClick(sec.slug)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative block px-3 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-accent ${
                        active ? 'text-accent bg-accent/10' : 'text-ink-soft hover:text-ink hover:bg-surface-2'
                      }`}
                    >
                      {sec.label}
                    </SpaLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Actions */}
          <div className="ml-auto xl:ml-0 flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button type="button" onClick={onOpenSearch} className={ICON_BUTTON} aria-label="Search news">
              <Search className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className={ICON_BUTTON}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-[18px] h-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="w-[18px] h-[18px]" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSubscribeOpen(true)}
              aria-haspopup="dialog"
              className="hidden sm:inline-flex items-center gap-1.5 ml-1 h-9 px-4 rounded-full bg-[#005EB8] text-white text-[13px] font-semibold shadow-sm hover:bg-[#004d99] hover:shadow transition focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              Subscribe
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`${ICON_BUTTON} xl:hidden`}
              aria-label={mobileMenuOpen ? 'Close sections menu' : 'Open sections menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-sections-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Tablet / mobile: horizontally scrolling section pills */}
        <nav aria-label="Sections" className="xl:hidden border-t border-line">
          <ul className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">
            {SITE_CONFIG.sections.map((sec) => {
              const active = isActive(sec.slug);
              return (
                <li key={sec.slug} className="shrink-0">
                  <SpaLink
                    href={categoryHref(sec.slug)}
                    onNavigate={() => handleSectionClick(sec.slug)}
                    aria-current={active ? 'page' : undefined}
                    className={`block px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 ${
                      active ? 'bg-ink text-page' : 'text-ink-soft hover:text-ink hover:bg-surface-2'
                    }`}
                  >
                    {sec.label}
                  </SpaLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Menu drawer */}
        {mobileMenuOpen && (
          <div id="mobile-sections-menu" className="xl:hidden border-t border-line bg-surface shadow-card">
            <ul className="max-w-7xl mx-auto px-3 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-3 gap-1">
              {SITE_CONFIG.sections.map((sec) => {
                const active = isActive(sec.slug);
                return (
                  <li key={sec.slug}>
                    <SpaLink
                      href={categoryHref(sec.slug)}
                      onNavigate={() => handleSectionClick(sec.slug)}
                      aria-current={active ? 'page' : undefined}
                      className={`block px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                        active ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-surface-2'
                      }`}
                    >
                      {sec.label}
                    </SpaLink>
                  </li>
                );
              })}
            </ul>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSubscribeOpen(true);
                }}
                aria-haspopup="dialog"
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#005EB8] text-white text-sm font-semibold"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Subscribe to the newsletter
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. BREAKING NEWS BAR (hidden when nothing is breaking) */}
      {/* Not a live region: moving headlines would interrupt screen readers constantly. */}
      {breakingNews.length > 0 && (
        <section aria-label="Breaking news" className="bg-surface border-b border-line">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-3">
            <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[#D92525] text-white text-[11px] font-bold uppercase tracking-wider pl-2.5 pr-3 py-1">
              <span className="relative flex w-2 h-2" aria-hidden="true">
                <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping motion-reduce:animate-none" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-white" />
              </span>
              Breaking
            </span>

            {animateTicker ? (
              <div
                className="ds-marquee-host flex-1 min-w-0 flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]"
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
                        <span className="w-1 h-1 rounded-full bg-line-strong" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            ) : (
              <ul className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto scrollbar-none">
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
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-line text-ink-muted hover:text-ink hover:bg-surface-2 transition"
              >
                {isUserPaused ? <Play className="w-3 h-3" aria-hidden="true" /> : <Pause className="w-3 h-3" aria-hidden="true" />}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Newsletter sign-up */}
      <Dialog
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        title="Subscribe to the newsletter"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        className="relative w-full max-w-md"
      >
        <button
          type="button"
          onClick={() => setSubscribeOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <NewsletterBox className="rounded-2xl! p-6! shadow-2xl" />
      </Dialog>
    </>
  );
};
