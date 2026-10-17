import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, X, Bookmark, Zap, Pause, Play } from 'lucide-react';
import { SpaLink, categoryHref } from './SpaLink';
import { CategoryType, Article } from '../types/news';
import { SITE_CONFIG } from '../config/site';

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

export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  onSelectCategory,
  onOpenSearch,
  onOpenSaved,
  onSelectArticle,
  savedCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [weatherText, setWeatherText] = useState<string>('Glasgow: Loading weather...');
  const [breakingNews, setBreakingNews] = useState<BreakingArticle[]>([]);
  const [activeTickerIdx, setActiveTickerIdx] = useState(0);
  // Rotation pauses while hovered/focused, and stays paused if the reader presses Pause (WCAG 2.2.2)
  const [isHovered, setIsHovered] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const isPaused = isHovered || isUserPaused;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Formatted date string
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // 1. Fetch real live weather from Open-Meteo for Glasgow (lat=55.8642, lon=-4.2518)
  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      try {
        const { latitude, longitude, name } = SITE_CONFIG.weatherLocation;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
        );
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json() as { current: { temperature_2m: number; weather_code: number } };
        if (mounted && data?.current) {
          const temp = Math.round(data.current.temperature_2m);
          const condition = weatherCodeToText(data.current.weather_code);
          setWeatherText(`${name}: ${temp}°C ${condition}`);
        }
      } catch (err) {
        if (mounted) {
          setWeatherText('Glasgow');
        }
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // refresh every 15 mins
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Breaking News Fetch (re-fetches every 60 seconds)
  useEffect(() => {
    let mounted = true;
    const fetchBreaking = async () => {
      try {
        const res = await fetch('/api/breaking');
        if (res.ok) {
          const data = await res.json() as { articles: BreakingArticle[] };
          if (mounted && data?.articles) {
            setBreakingNews(data.articles);
          }
        }
      } catch (e) {
        // Fallback / offline
      }
    };

    fetchBreaking();
    const tickerInterval = setInterval(fetchBreaking, 60 * 1000); // 60s re-fetch
    return () => {
      mounted = false;
      clearInterval(tickerInterval);
    };
  }, []);

  // 3. Motion preference check
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 4. Headline rotator (every 6 seconds, pauses on hover/focus)
  useEffect(() => {
    if (breakingNews.length <= 1 || isPaused || prefersReducedMotion) return;

    const interval = setInterval(() => {
      setActiveTickerIdx((prev) => (prev + 1) % breakingNews.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [breakingNews.length, isPaused, prefersReducedMotion]);

  const currentBreaking = breakingNews[activeTickerIdx];

  const handleSectionClick = (slug: string) => {
    if (slug === 'home') {
      onSelectCategory('all');
    } else {
      onSelectCategory(slug as CategoryType);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="w-full bg-white border-b border-neutral-300">
      {/* 1. TOP UTILITY LINE */}
      <div className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 text-[11px] px-3 py-1 font-sans">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium text-neutral-800">{dateStr}</span>
            <span className="text-neutral-500" aria-hidden="true">|</span>
            <span className="text-neutral-700 font-medium">{weatherText}</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-600">
            <button
              type="button"
              onClick={onOpenSaved}
              className="hover:text-[#005EB8] flex items-center gap-1 font-medium transition min-h-6"
              aria-haspopup="dialog"
            >
              <Bookmark className="w-3 h-3 text-neutral-600" aria-hidden="true" />
              <span>Saved ({savedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MASTHEAD */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between border-b border-neutral-200">
        <SpaLink
          href="/"
          onNavigate={() => onSelectCategory('all')}
          className="group flex items-baseline gap-2 select-none"
        >
          <span className="font-headline font-black text-2xl sm:text-3xl tracking-tight text-[#0B2545] uppercase">
            {SITE_CONFIG.name}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] hidden sm:inline border-l border-neutral-300 pl-2">
            Glasgow & West
          </span>
          <span className="sr-only">– homepage</span>
        </SpaLink>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-800 hover:text-[#005EB8] hover:bg-neutral-100 border border-neutral-300 transition"
            aria-label="Search news"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-neutral-800 hover:bg-neutral-100 border border-neutral-300"
            aria-label={mobileMenuOpen ? 'Close sections menu' : 'Open sections menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-sections-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* 3. CANONICAL SECTIONS NAVIGATION BAR */}
      {/* Exact required order: Home, News, Glasgow, Scotland, Politics, Business, Property, Sport, What's On, Opinion */}
      <nav className="bg-[#0B2545] text-white" aria-label="Sections">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <ul className="hidden md:flex items-center space-x-0.5 overflow-x-auto text-[13px] font-bold uppercase tracking-wider scrollbar-none">
            {SITE_CONFIG.sections.map((sec) => {
              const isActive = sec.slug === 'home' ? currentCategory === 'all' : currentCategory === sec.slug;
              return (
                <li key={sec.slug} className="shrink-0">
                  <SpaLink
                    href={categoryHref(sec.slug)}
                    onNavigate={() => handleSectionClick(sec.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block px-3 py-2.5 transition whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${
                      isActive ? 'bg-[#005EB8] text-white font-black' : 'text-neutral-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {sec.label}
                  </SpaLink>
                </li>
              );
            })}
          </ul>

          {/* Mobile horizontal section scroller */}
          <ul className="md:hidden flex items-center overflow-x-auto text-xs font-bold uppercase tracking-wider py-1 scrollbar-none">
            {SITE_CONFIG.sections.map((sec) => {
              const isActive = sec.slug === 'home' ? currentCategory === 'all' : currentCategory === sec.slug;
              return (
                <li key={sec.slug} className="shrink-0">
                  <SpaLink
                    href={categoryHref(sec.slug)}
                    onNavigate={() => handleSectionClick(sec.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block px-2.5 py-2 whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${
                      isActive ? 'bg-[#005EB8] text-white' : 'text-neutral-200 hover:text-white'
                    }`}
                  >
                    {sec.label}
                  </SpaLink>
                </li>
              );
            })}
          </ul>

          {/* Mobile Nav Menu Drawer (Full vertical list when toggle clicked) */}
          {mobileMenuOpen && (
            <ul id="mobile-sections-menu" className="md:hidden py-2 space-y-0.5 border-t border-white/15">
              {SITE_CONFIG.sections.map((sec) => {
                const isActive = sec.slug === 'home' ? currentCategory === 'all' : currentCategory === sec.slug;
                return (
                  <li key={sec.slug}>
                    <SpaLink
                      href={categoryHref(sec.slug)}
                      onNavigate={() => handleSectionClick(sec.slug)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`block w-full text-left px-3 py-2 text-xs font-bold uppercase transition focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${
                        isActive ? 'bg-[#005EB8] text-white' : 'text-neutral-200 hover:bg-white/10'
                      }`}
                    >
                      {sec.label}
                    </SpaLink>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      {/* 4. BREAKING NEWS TICKER (hidden when nothing is breaking) */}
      {/* Not a live region: rotating headlines would interrupt screen readers every few seconds. */}
      {breakingNews.length > 0 && currentBreaking && (
        <section
          aria-label="Breaking news"
          className="bg-neutral-900 text-white border-b border-neutral-300 px-4 py-1.5 transition-colors"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="bg-[#D92525] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" aria-hidden="true" />
                Breaking
              </span>

              {/* Reduced motion: show all headlines as a static list */}
              {prefersReducedMotion ? (
                <ul className="flex items-center gap-3 overflow-x-auto truncate">
                  {breakingNews.map((art, idx) => (
                    <li key={art.id} className="shrink-0">
                      <SpaLink
                        href={`/news/${encodeURIComponent(art.slug)}`}
                        onNavigate={() => onSelectArticle(toStub(art))}
                        className="font-bold hover:underline hover:text-neutral-200"
                      >
                        {art.title}
                      </SpaLink>
                      {idx < breakingNews.length - 1 && <span aria-hidden="true"> •</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <SpaLink
                  href={`/news/${encodeURIComponent(currentBreaking.slug)}`}
                  onNavigate={() => onSelectArticle(toStub(currentBreaking))}
                  className="font-bold hover:underline hover:text-neutral-200 truncate text-left transition-opacity duration-300"
                >
                  {currentBreaking.title}
                </SpaLink>
              )}
            </div>

            {breakingNews.length > 1 && !prefersReducedMotion && (
              <div className="shrink-0 flex items-center gap-2 text-[11px] text-neutral-300">
                <span className="hidden sm:inline" aria-hidden="true">
                  {activeTickerIdx + 1} of {breakingNews.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsUserPaused((v) => !v)}
                  aria-pressed={isUserPaused}
                  aria-label={isUserPaused ? 'Resume rotating breaking headlines' : 'Pause rotating breaking headlines'}
                  className="flex items-center justify-center w-6 h-6 border border-neutral-600 hover:bg-white/10"
                >
                  {isUserPaused ? <Play className="w-3 h-3" aria-hidden="true" /> : <Pause className="w-3 h-3" aria-hidden="true" />}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </header>
  );
};
