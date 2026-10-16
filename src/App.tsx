import React, { useState, useEffect } from 'react';
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
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
  const [currentView, setCurrentView] = useState<'home' | 'category' | 'article' | 'search' | 'notfound'>('home');
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
      }
    };

    const initRouting = async () => {
      articleCache = await refreshArticles();
      await routeFromLocation(articleCache);
    };

    const handlePopState = () => {
      routeFromLocation(articleCache);
    };

    initRouting();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. SEO Sync: Dynamic Document Title, Meta Tags, and NewsArticle JSON-LD
  useEffect(() => {
    let title = "The Daily Scot | Glasgow & Scotland's News";
    let desc = "Latest breaking news, Glasgow council, traffic, Celtic, Rangers, courts and local Scottish reporting.";

    const existingLd = document.getElementById('daily-scot-jsonld');
    if (existingLd) existingLd.remove();

    if (currentView === 'article' && currentArticle) {
      title = `${currentArticle.title} - The Daily Scot`;
      desc = currentArticle.standfirst;

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': window.location.href,
        },
        headline: currentArticle.title,
        description: currentArticle.standfirst,
        image: [currentArticle.heroImage],
        datePublished: currentArticle.publishedAt,
        dateModified: currentArticle.updatedAt || currentArticle.publishedAt,
        author: {
          '@type': 'Person',
          name: currentArticle.author.name,
          jobTitle: currentArticle.author.role,
        },
        publisher: {
          '@type': 'NewsMediaOrganization',
          name: 'The Daily Scot',
          url: 'https://dailyscot.co.uk',
        },
        articleSection: currentArticle.category,
        keywords: currentArticle.tags.join(', '),
      };

      const script = document.createElement('script');
      script.id = 'daily-scot-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    } else if (currentView === 'category' && currentCategory !== 'all') {
      const catName = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
      title = `${catName} News | The Daily Scot`;
      desc = `Latest ${catName} reporting, courts, and local news from Glasgow and Scotland.`;
    } else if (currentView === 'search') {
      title = "Search Articles | The Daily Scot";
    } else if (currentView === 'notfound') {
      title = 'Story not found | The Daily Scot';
      desc = 'The page you were looking for could not be found.';
    }

    // Tell search engines not to index the "not found" page
    let robots = document.querySelector('meta[name="robots"]');
    if (currentView === 'notfound') {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex');
    } else if (robots) {
      robots.remove();
    }

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView, currentCategory, currentArticle]);

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
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-medium">
                Unable to load the latest stories: {loadError}
              </span>
            </div>
            <button
              onClick={refreshArticles}
              className="flex items-center gap-1 font-bold text-red-700 hover:text-red-900 underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1">
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
            articles={articles}
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

        {currentView === 'notfound' && (
          <section className="max-w-xl mx-auto text-center py-20 px-4">
            <p className="text-xs font-black uppercase tracking-wider text-[#005EB8] mb-2">Error 404</p>
            <h1 className="font-headline font-black text-3xl text-neutral-900 mb-3">Story not found</h1>
            <p className="text-neutral-600 mb-6">
              This story may have been moved, unpublished, or the link may be incorrect.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handleSelectCategory('all')}
                className="px-4 py-2 bg-[#0B2545] text-white text-sm font-bold"
              >
                Go to the homepage
              </button>
              <button
                onClick={handleOpenSearch}
                className="px-4 py-2 border border-neutral-300 text-neutral-900 text-sm font-bold"
              >
                Search stories
              </button>
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
