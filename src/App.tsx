import React, { useState, useEffect, useRef } from 'react';
import { Article, CategoryType } from './types/news';
import { 
  getPublicArticles, 
  getArticleBySlug 
} from './services/api';
import { 
  getSavedArticleIds, 
  toggleSavedArticle 
} from './services/storage';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SavedArticlesModal } from './components/SavedArticlesModal';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { ArticlePage } from './pages/ArticlePage';
import { SearchPage } from './pages/SearchPage';
import { AuthorPage } from './pages/AuthorPage';
import { InfoPage } from './pages/InfoPage';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { SpaLink } from './components/SpaLink';
import { SITE_CONFIG } from './config/site';
import { HOME_TITLE, SITE_DESCRIPTION, sectionSeo, withBrand } from './config/seoText';
import { InfoPageId, companyDetailsIncomplete, infoPageByPath } from './config/infoPages';
import { HeadSeo, applyHeadSeo, serverWroteHead } from './utils/seoHead';

async function safeGetArticle(slug: string): Promise<Article | null> {
  try {
    return await getArticleBySlug(slug);
  } catch (e) {
    console.error('Failed to load article', slug, e);
    return null;
  }
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'category' | 'article' | 'search' | 'author' | 'info' | 'notfound'>('home');
  // Company / legal pages (/about, /privacy...)
  const [infoPageId, setInfoPageId] = useState<InfoPageId | null>(null);
  // Author pages (/author/<slug>?page=N). authorName: undefined while loading, null when not found.
  const [authorSlug, setAuthorSlug] = useState('');
  const [authorPageNum, setAuthorPageNum] = useState(1);
  const [authorName, setAuthorName] = useState<string | null | undefined>(undefined);
  const [currentCategory, setCurrentCategory] = useState<CategoryType>('all');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedArticleIds());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Saved Drawer
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);

  // Load articles from Public API
  const refreshArticles = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await getPublicArticles();
      setArticles(list);
      return list;
    } catch (e: any) {
      console.error('Failed to load articles', e);
      setLoadError(e?.message || 'Unable to load news dispatch from server.');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initial Path Routing & History Listeners
  useEffect(() => {
    let articleCache: Article[] = [];

    const routeFromLocation = async (list: Article[]) => {
      const path = window.location.pathname;

      if (path === '/' || path === '') {
        setCurrentArticle(null);
        setCurrentCategory('all');
        setCurrentView('home');
      } else if (path === '/search') {
        setCurrentView('search');
      } else if (infoPageByPath(path)) {
        setCurrentArticle(null);
        setCurrentCategory('all');
        setInfoPageId(infoPageByPath(path)!.id);
        setCurrentView('info');
      } else if (path === '/author' || path.startsWith('/author/')) {
        let slug = '';
        try {
          slug = decodeURIComponent(path.replace(/^\/author\/?/, '').replace(/\/$/, '')).toLowerCase();
        } catch {
          slug = '';
        }
        const pageNum = Math.max(1, parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10) || 1);
        setCurrentArticle(null);
        setCurrentCategory('all');
        if (!slug || slug.includes('/')) {
          setCurrentView('notfound');
        } else {
          setAuthorSlug(slug);
          setAuthorName(undefined); // AuthorPage reports the name (or not found) once loaded
          setAuthorPageNum(pageNum);
          setCurrentView('author');
        }
      } else if (path.startsWith('/news/')) {
        const remaining = path.replace('/news/', '').replace(/\/$/, '');
        const parts = remaining.split('/');

        if (parts.length === 1) {
          const item = parts[0];
          // Check if item is a known category
          const isCategory = ['news', 'glasgow', 'scotland', 'politics', 'business', 'property', 'sport', 'whats-on', 'opinion'].includes(item);
          if (isCategory) {
            setCurrentCategory(item as CategoryType);
            setCurrentView('category');
          } else {
            // It's an article slug
            const match = (await safeGetArticle(item)) || list.find((a) => a.slug === item);
            if (match) {
              setCurrentArticle(match);
              setCurrentCategory(match.category);
              setCurrentView('article');
            } else {
              setCurrentArticle(null);
              setCurrentCategory('all');
              setCurrentView('notfound');
            }
          }
        } else if (parts.length >= 2) {
          const cat = parts[0] as CategoryType;
          const slug = parts[1];
          const match = (await safeGetArticle(slug)) || list.find((a) => a.slug === slug);
          if (match) {
            setCurrentArticle(match);
            setCurrentCategory(match.category);
            setCurrentView('article');
          } else {
            setCurrentArticle(null);
            setCurrentCategory(cat || 'all');
            setCurrentView('notfound');
          }
        }
      } else {
        // Any other address isn't a page of the site: say so (and keep it out of Google) instead of
        // showing the homepage's content under a made-up URL
        setCurrentArticle(null);
        setCurrentCategory('all');
        setCurrentView('notfound');
      }
    };

    const initRouting = async () => {
      articleCache = await refreshArticles();
      await routeFromLocation(articleCache);
      setRouteReady(true);
    };

    const handlePopState = () => {
      routeFromLocation(articleCache);
    };

    initRouting();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A section page needs that section's own stories: the list above is only the latest 20 across the whole site,
  // so an older section (Property, Opinion...) would otherwise look empty.
  const [sectionStories, setSectionStories] = useState<{ category: string; list: Article[] } | null>(null);
  useEffect(() => {
    if (currentView !== 'category' || currentCategory === 'all') return;
    let cancelled = false;
    getPublicArticles({ category: currentCategory, limit: 50 })
      .then((list) => {
        if (!cancelled) setSectionStories({ category: currentCategory, list });
      })
      .catch((e) => console.error('Failed to load section stories', currentCategory, e));
    return () => {
      cancelled = true;
    };
  }, [currentView, currentCategory]);

  // Accessibility: after in-app navigation, move focus to the new page's content so screen-reader and
  // keyboard users start at the top of the new page (the browser would do this on a full page load).
  const mainRef = useRef<HTMLElement>(null);
  const [routeReady, setRouteReady] = useState(false);
  const lastRouteKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${currentView}|${currentCategory}|${currentArticle?.id || ''}|${currentView === 'author' ? `${authorSlug}:${authorPageNum}` : ''}`;
    const previous = lastRouteKey.current;
    lastRouteKey.current = routeReady ? key : null;
    // Don't steal focus on the first page load, only after the reader navigates
    if (!routeReady || previous === null || previous === key) return;
    // The search page focuses its search box itself
    if (currentView === 'search') return;
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    } else {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [currentView, currentCategory, currentArticle?.id, routeReady, authorSlug, authorPageNum]);

  // 2. SEO sync: title, description, canonical link and robots for the page the reader is on.
  // On the first load the server has already written all of these (plus the structured data) for this exact
  // address, using the newsroom's own SEO title and description, so leave them alone until the reader navigates.
  const firstUrl = useRef(window.location.pathname + window.location.search);
  const hasNavigated = useRef(false);
  useEffect(() => {
    if (!hasNavigated.current) {
      if (serverWroteHead() && window.location.pathname + window.location.search === firstUrl.current) return;
      hasNavigated.current = true;
    }

    const origin = `https://${SITE_CONFIG.siteUrl}`;
    let seo: HeadSeo = { title: HOME_TITLE, description: SITE_DESCRIPTION, canonical: `${origin}/` };

    if (currentView === 'article' && currentArticle) {
      seo = {
        title: withBrand(currentArticle.seoTitle || currentArticle.title),
        description: currentArticle.metaDescription || currentArticle.standfirst,
        canonical: `${origin}/news/${encodeURIComponent(currentArticle.slug)}`,
      };
    } else if (currentView === 'category' && currentCategory !== 'all') {
      const label = SITE_CONFIG.sections.find((sec) => sec.slug === currentCategory)?.label || currentCategory;
      seo = { ...sectionSeo(currentCategory, label), canonical: `${origin}/news/${encodeURIComponent(currentCategory)}` };
    } else if (currentView === 'search') {
      // Search results are different for every search and not worth a place in Google
      seo = { title: withBrand('Search stories'), description: 'Search stories from The Daily Scot.', noindex: true };
    } else if (currentView === 'author') {
      if (authorName === undefined) return; // still loading: keep the tags as they are
      seo =
        authorName === null
          ? { title: withBrand('Author not found'), description: 'There are no published stories with this byline.', noindex: true }
          : {
              title: withBrand(`${authorName}${authorPageNum > 1 ? ` – page ${authorPageNum}` : ''}`),
              description: `The latest stories from ${authorName} at ${SITE_CONFIG.name}.`,
              canonical: `${origin}/author/${encodeURIComponent(authorSlug)}${authorPageNum > 1 ? `?page=${authorPageNum}` : ''}`,
            };
    } else if (currentView === 'info') {
      const info = infoPageByPath(window.location.pathname);
      if (!info) return;
      // Kept out of Google until the company details in site.ts are real (see companyDetailsIncomplete)
      seo = {
        title: withBrand(info.title),
        description: info.description,
        canonical: `${origin}${info.path}`,
        noindex: companyDetailsIncomplete(),
      };
    } else if (currentView === 'notfound') {
      seo = {
        title: withBrand('Page not found'),
        description: 'The page you were looking for could not be found.',
        noindex: true,
      };
    }

    applyHeadSeo(seo);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView, currentCategory, currentArticle, authorSlug, authorPageNum, authorName]);

  // Handle article selection with Clean URL
  const handleSelectArticle = async (article: Article) => {
    // Breaking-news ticker passes a lightweight stub with no body; load the full story.
    if (article.isPartial || !article.content || article.content.length === 0) {
      const full = await safeGetArticle(article.slug);
      if (full) article = full;
    }
    setCurrentArticle(article);
    setCurrentCategory(article.category);
    setCurrentView('article');
    window.history.pushState({}, '', `/news/${encodeURIComponent(article.slug)}`);
  };

  // Handle category selection with Clean URL
  const handleSelectCategory = (cat: CategoryType) => {
    setCurrentCategory(cat);
    if (cat === 'all') {
      setCurrentView('home');
      window.history.pushState({}, '', '/');
    } else {
      setCurrentView('category');
      window.history.pushState({}, '', `/news/${encodeURIComponent(cat)}`);
    }
  };

  const handleSelectArea = (area: string) => {
    setSelectedArea(area);
    if (currentView !== 'home') {
      setCurrentCategory('all');
      setCurrentView('home');
      window.history.pushState({}, '', '/');
    }
  };

  const handleOpenSearch = () => {
    setCurrentView('search');
    window.history.pushState({}, '', '/search');
  };

  // Toggle bookmark
  const handleToggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSavedArticle(id);
    setSavedIds(getSavedArticleIds());
  };

  const handleRemoveSaved = (id: string) => {
    toggleSavedArticle(id);
    setSavedIds(getSavedArticleIds());
  };

  const savedArticlesList = articles.filter((a) => savedIds.includes(a.id));

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans selection:bg-[#005EB8] selection:text-white">
      {/* Newspaper Header */}
      {/* Skip link: first thing keyboard users reach on every page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-[#0B2545] focus:px-4 focus:py-2 focus:font-bold focus:outline-3 focus:outline-[#005EB8]"
      >
        Skip to main content
      </a>

      <Header
        currentCategory={currentCategory}
        onSelectCategory={handleSelectCategory}
        onOpenSearch={handleOpenSearch}
        onOpenSaved={() => setIsSavedDrawerOpen(true)}
        onSelectArticle={handleSelectArticle}
        savedCount={savedIds.length}
      />

      {/* Production Error Banner if API fails */}
      {loadError && (
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-3" role="alert">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
              <span className="font-medium">
                Unable to load the latest stories: {loadError}
              </span>
            </div>
            <button
              type="button"
              onClick={refreshArticles}
              className="flex items-center gap-1 font-bold text-red-700 hover:text-red-900 underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 motion-reduce:animate-none ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        {currentView === 'home' && (
          <HomePage
            articles={articles}
            selectedArea={selectedArea}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {currentView === 'category' && (
          <CategoryPage
            category={currentCategory}
            articles={sectionStories?.category === currentCategory ? sectionStories.list : articles}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {currentView === 'article' && currentArticle && (
          <ArticlePage
            article={currentArticle}
            allArticles={articles}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
            isSaved={savedIds.includes(currentArticle.id)}
            onToggleSave={handleToggleSave}
            onArticleUpdated={refreshArticles}
          />
        )}

        {currentView === 'author' && authorSlug && (
          <AuthorPage
            slug={authorSlug}
            page={authorPageNum}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
            onLoaded={(result) => setAuthorName(result ? result.author.name : null)}
          />
        )}

        {currentView === 'info' && infoPageId && (
          <InfoPage id={infoPageId} onSelectCategory={handleSelectCategory} />
        )}

        {currentView === 'notfound' && (
          <section className="max-w-xl mx-auto text-center py-20 px-4">
            <p className="text-xs font-black uppercase tracking-wider text-[#005EB8] mb-2">Error 404</p>
            <h1 className="font-headline font-black text-3xl text-neutral-900 mb-3">Page not found</h1>
            <p className="text-neutral-600 mb-6">
              This page may have been moved, unpublished, or the link may be incorrect.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <SpaLink
                href="/"
                onNavigate={() => handleSelectCategory('all')}
                className="px-4 py-2 bg-[#0B2545] text-white text-sm font-bold"
              >
                Go to the homepage
              </SpaLink>
              <SpaLink
                href="/search"
                onNavigate={handleOpenSearch}
                className="px-4 py-2 border border-neutral-300 text-neutral-900 text-sm font-bold"
              >
                Search stories
              </SpaLink>
            </div>
          </section>
        )}

        {currentView === 'search' && (
          <SearchPage
            articles={articles}
            onSelectArticle={handleSelectArticle}
            onSelectCategory={handleSelectCategory}
          />
        )}
      </main>

      {/* Footer (Strictly public, no admin code or links) */}
      <Footer onSelectCategory={handleSelectCategory} />

      {/* Saved Articles Drawer */}
      <SavedArticlesModal
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedArticles={savedArticlesList}
        onSelectArticle={handleSelectArticle}
        onRemoveSaved={handleRemoveSaved}
      />
    </div>
  );
}
