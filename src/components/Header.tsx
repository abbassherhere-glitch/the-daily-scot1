import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, X, Bookmark, ChevronRight, Zap } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);
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
            <span className="text-neutral-400">|</span>
            <span className="text-neutral-700 font-medium">{weatherText}</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-600">
            <button
              onClick={onOpenSaved}
              className="hover:text-[#005EB8] flex items-center gap-1 font-medium transition"
              title="Saved reading list"
            >
              <Bookmark className="w-3 h-3 text-neutral-500" />
              <span>Saved ({savedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MASTHEAD */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between border-b border-neutral-200">
        <div
          onClick={() => onSelectCategory('all')}
          className="cursor-pointer group flex items-baseline gap-2 select-none"
        >
          <div className="flex items-center">
            <span className="font-headline font-black text-2xl sm:text-3xl tracking-tight text-[#0B2545] uppercase">
              {SITE_CONFIG.name}
            </span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] hidden sm:inline border-l border-neutral-300 pl-2">
            Glasgow & West
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-800 hover:text-[#005EB8] hover:bg-neutral-100 border border-neutral-300 transition"
            title="Search news"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-neutral-800 hover:bg-neutral-100 border border-neutral-300"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 3. CANONICAL SECTIONS NAVIGATION BAR */}
      {/* Exact required order: Home, News, Glasgow, Scotland, Politics, Business, Property, Sport, What's On, Opinion */}
      <nav className="bg-[#0B2545] text-white">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="hidden md:flex items-center space-x-0.5 overflow-x-auto text-[13px] font-bold uppercase tracking-wider scrollbar-none">
            {SITE_CONFIG.sections.map((sec) => {
              const isActive =
                sec.slug === 'home'
                  ? currentCategory === 'all'
                  : currentCategory === sec.slug;
              return (
                <button
                  key={sec.slug}
                  onClick={() => handleSectionClick(sec.slug)}
                  className={`px-3 py-2.5 transition whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#005EB8] text-white font-black'
                      : 'text-neutral-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Horizontal Section Scroll (no overflow) */}
          <div className="md:hidden flex items-center overflow-x-auto text-xs font-bold uppercase tracking-wider py-1 scrollbar-none">
            {SITE_CONFIG.sections.map((sec) => {
              const isActive =
                sec.slug === 'home'
                  ? currentCategory === 'all'
                  : currentCategory === sec.slug;
              return (
                <button
                  key={sec.slug}
                  onClick={() => handleSectionClick(sec.slug)}
                  className={`px-2.5 py-1.5 whitespace-nowrap shrink-0 transition ${
                    isActive
                      ? 'bg-[#005EB8] text-white'
                      : 'text-neutral-200 hover:text-white'
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Nav Menu Drawer (Full vertical list when toggle clicked) */}
          {mobileMenuOpen && (
            <div className="md:hidden py-2 space-y-0.5 border-t border-white/15">
              {SITE_CONFIG.sections.map((sec) => {
                const isActive =
                  sec.slug === 'home'
                    ? currentCategory === 'all'
                    : currentCategory === sec.slug;
                return (
                  <button
                    key={sec.slug}
                    onClick={() => handleSectionClick(sec.slug)}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase transition ${
                      isActive ? 'bg-[#005EB8] text-white' : 'text-neutral-200 hover:bg-white/10'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* 4. AUTOMATIC BREAKING NEWS TICKER */}
      {/* Hidden completely when nothing is breaking */}
      {breakingNews.length > 0 && currentBreaking && (
        <div
          className="bg-neutral-900 text-white border-b border-neutral-300 px-4 py-1.5 transition-colors"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          aria-live="polite"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="bg-[#D92525] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" />
                Breaking
              </span>

              {/* Reduced motion: Show all headlines as a static clean list */}
              {prefersReducedMotion ? (
                <div className="flex items-center gap-3 overflow-x-auto truncate">
                  {breakingNews.map((art, idx) => (
                    <button
                      key={art.id}
                      onClick={() =>
                        onSelectArticle({
                          id: art.id,
                          slug: art.slug,
                          title: art.title,
                          standfirst: art.standfirst || '',
                          category: art.category as CategoryType,
                          publishedAt: art.published_at || new Date().toISOString(),
                          content: [],
                          tags: [],
                          author: { name: 'Staff Reporter', role: 'Reporter', avatar: '' },
                          heroImage: '',
                          heroCaption: '',
                          heroCredit: '',
                          readTime: '',
                          views: 0,
                          comments: [],
                        })
                      }
                      className="font-bold hover:underline hover:text-neutral-200 truncate text-left"
                    >
                      {art.title} {idx < breakingNews.length - 1 && '•'}
                    </button>
                  ))}
                </div>
              ) : (
                /* Animated Rotating Headline with fade */
                <button
                  onClick={() =>
                    onSelectArticle({
                      id: currentBreaking.id,
                      slug: currentBreaking.slug,
                      title: currentBreaking.title,
                      standfirst: currentBreaking.standfirst || '',
                      category: currentBreaking.category as CategoryType,
                      publishedAt: currentBreaking.published_at || new Date().toISOString(),
                      content: [],
                      tags: [],
                      author: { name: 'Staff Reporter', role: 'Reporter', avatar: '' },
                      heroImage: '',
                      heroCaption: '',
                      heroCredit: '',
                      readTime: '',
                      views: 0,
                      comments: [],
                    })
                  }
                  className="font-bold hover:underline hover:text-neutral-200 truncate text-left transition-opacity duration-300"
                >
                  {currentBreaking.title}
                </button>
              )}
            </div>

            <div className="text-[11px] text-neutral-400 shrink-0 hidden sm:flex items-center gap-1">
              {breakingNews.length > 1 && !prefersReducedMotion && (
                <span className="text-[10px] text-neutral-400 mr-2">
                  {activeTickerIdx + 1} of {breakingNews.length}
                </span>
              )}
              <span className="text-[11px]">View</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
