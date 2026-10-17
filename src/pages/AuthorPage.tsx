import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import { SpaLink, authorHref, navigateTo } from '../components/SpaLink';
import { getAuthorPage, AuthorPageResult } from '../services/api';

interface AuthorPageProps {
  slug: string;
  page: number;
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
  /** Called once the author is known (for the page title) or found missing */
  onLoaded?: (result: AuthorPageResult | null) => void;
}

/**
 * /author/<slug> – every published story with this byline, newest first, using the same
 * lead + grid card layout as section pages, with pagination.
 */
export const AuthorPage: React.FC<AuthorPageProps> = ({ slug, page, onSelectArticle, onSelectCategory, onLoaded }) => {
  const [data, setData] = useState<AuthorPageResult | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getAuthorPage(slug, page)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setState(result ? 'ready' : 'notfound');
        onLoaded?.(result);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load author page', e);
        setState('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, page]);

  if (state === 'loading') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-neutral-500" role="status">
        Loading stories…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <section className="max-w-xl mx-auto text-center py-20 px-4" role="alert">
        <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" aria-hidden="true" />
        <h1 className="font-headline font-black text-2xl text-neutral-900 mb-3">Unable to load this page</h1>
        <p className="text-neutral-600 mb-6">Please check your connection and try again.</p>
        <button
          type="button"
          onClick={() => navigateTo(window.location.pathname + window.location.search)}
          className="px-4 py-2 bg-[#0B2545] text-white text-sm font-bold"
        >
          Retry
        </button>
      </section>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <section className="max-w-xl mx-auto text-center py-20 px-4">
        <p className="text-xs font-black uppercase tracking-wider text-[#005EB8] mb-2">Error 404</p>
        <h1 className="font-headline font-black text-3xl text-neutral-900 mb-3">Author not found</h1>
        <p className="text-neutral-600 mb-6">There are no published stories with this byline.</p>
        <SpaLink
          href="/"
          onNavigate={() => onSelectCategory('all')}
          className="px-4 py-2 bg-[#0B2545] text-white text-sm font-bold"
        >
          Go to the homepage
        </SpaLink>
      </section>
    );
  }

  const { author, articles, totalPages, total } = data;
  const leadStory = page === 1 ? articles[0] : undefined;
  const gridStories = leadStory ? articles.slice(1) : articles;
  const pageHref = (p: number) => authorHref(author, p);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-6 bg-white">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-neutral-200 pb-2">
        <ol className="flex items-center gap-1.5 text-xs uppercase font-black tracking-wider text-[#005EB8]">
          <li>
            <SpaLink href="/" onNavigate={() => onSelectCategory('all')} className="hover:underline inline-block py-1">
              Home
            </SpaLink>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-3 h-3 text-neutral-500" />
          </li>
          <li className="text-neutral-900" aria-current="page">
            {author.name}
          </li>
        </ol>
      </nav>

      {/* Author header (name and bio from Staff Users) */}
      <div className="border-b-4 border-[#0B2545] pb-3 flex items-start gap-4">
        {author.photo ? (
          <img
            src={author.photo}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-neutral-300 shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-16 h-16 rounded-full bg-[#0B2545] text-white flex items-center justify-center font-headline font-black text-2xl shrink-0"
          >
            {author.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-headline font-black text-3xl sm:text-4xl text-neutral-900 tracking-tight">
            {author.name}
          </h1>
          <p className="text-[11px] uppercase font-black tracking-wider text-[#005EB8] mt-0.5">{author.role}</p>
          {author.bio && <p className="text-sm text-neutral-700 font-serif mt-2 max-w-3xl">{author.bio}</p>}
          <p className="text-xs text-neutral-500 mt-2">
            {total} {total === 1 ? 'story' : 'stories'}
            {totalPages > 1 && ` • Page ${page} of ${totalPages}`}
          </p>
        </div>
      </div>

      <AdBanner type="leaderboard" className="my-2" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {articles.length === 0 ? (
            <p className="text-sm text-neutral-600 py-8">
              There are no more stories on this page.{' '}
              <SpaLink href={pageHref(1)} onNavigate={() => navigateTo(pageHref(1))} className="text-[#005EB8] underline">
                Go to the latest stories
              </SpaLink>
            </p>
          ) : (
            <>
              {leadStory && <ArticleCard article={leadStory} variant="lead" onSelect={onSelectArticle} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {gridStories.map((art) => (
                  <ArticleCard key={art.id} article={art} variant="grid-card" onSelect={onSelectArticle} />
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between border-t border-neutral-200 pt-4 text-sm">
              {page > 1 ? (
                <SpaLink
                  href={pageHref(page - 1)}
                  onNavigate={() => navigateTo(pageHref(page - 1))}
                  className="flex items-center gap-1 font-bold text-[#005EB8] hover:underline"
                  rel="prev"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Newer stories
                </SpaLink>
              ) : (
                <span />
              )}

              <ol className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, i, list) => (
                    <li key={p} className="flex items-center gap-1">
                      {i > 0 && list[i - 1] !== p - 1 && <span className="text-neutral-400 px-1">…</span>}
                      {p === page ? (
                        <span aria-current="page" className="px-2.5 py-1 bg-[#0B2545] text-white font-bold text-xs">
                          {p}
                        </span>
                      ) : (
                        <SpaLink
                          href={pageHref(p)}
                          onNavigate={() => navigateTo(pageHref(p))}
                          className="px-2.5 py-1 border border-neutral-300 text-neutral-800 hover:bg-neutral-100 font-bold text-xs"
                          aria-label={`Page ${p}`}
                        >
                          {p}
                        </SpaLink>
                      )}
                    </li>
                  ))}
              </ol>

              {page < totalPages ? (
                <SpaLink
                  href={pageHref(page + 1)}
                  onNavigate={() => navigateTo(pageHref(page + 1))}
                  className="flex items-center gap-1 font-bold text-[#005EB8] hover:underline"
                  rel="next"
                >
                  Older stories <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </SpaLink>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <AdBanner type="mpu" />
        </aside>
      </div>
    </div>
  );
};
