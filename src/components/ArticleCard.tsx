import React from 'react';
import { Article } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { SpaLink, STAFF_BYLINE, articleHref, authorHref, navigateTo } from './SpaLink';

export type ArticleCardVariant = 'lead' | 'overlay' | 'grid-card' | 'thumb-left' | 'text-only';

interface ArticleCardProps {
  article: Article;
  variant?: ArticleCardVariant;
  onSelect: (article: Article) => void;
  className?: string;
  /** thumb-left only: show a ranking number on the thumbnail (Most Read lists) */
  rank?: number;
}

const PLACEHOLDER = '/placeholder-hero.svg';

// The headline link covers the whole card (so the card stays clickable) while keeping a single,
// properly named link for keyboard and screen-reader users.
const STRETCHED_LINK =
  "after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-[#005EB8] focus-visible:after:outline-offset-2 focus-visible:after:rounded-[inherit]";

/** Badge colours per section (full class strings so Tailwind keeps them). */
const BADGE: Record<string, string> = {
  news: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  glasgow: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  scotland: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  politics: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  business: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  property: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  sport: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'whats-on': 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  opinion: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};
const BADGE_DEFAULT = 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300';

/** Section label for display, e.g. "whats-on" -> "What's On". */
function sectionName(article: Article): string {
  if (article.subcategory) return article.subcategory;
  return SITE_CONFIG.sections.find((s) => s.slug === article.category)?.label || article.category;
}

/** "Just now", "12 mins ago", "3 hours ago", "Yesterday", "14 Oct" */
export function timeAgo(iso: string): string {
  const past = new Date(iso);
  if (Number.isNaN(past.getTime())) return '';
  const diffMins = Math.floor((Date.now() - past.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffHours < 48) return 'Yesterday';
  return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const CardImage: React.FC<{ src: string; eager?: boolean; className?: string }> = ({ src, eager, className = '' }) => (
  <img
    src={src || PLACEHOLDER}
    alt=""
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
    fetchPriority={eager ? 'high' : undefined}
    onError={(e) => {
      const img = e.currentTarget;
      if (!img.src.endsWith(PLACEHOLDER)) img.src = PLACEHOLDER;
    }}
    className={`w-full h-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none ${className}`}
  />
);

const BreakingBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D92525] text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1">
    <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
    Breaking
  </span>
);

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  variant = 'grid-card',
  onSelect,
  className = '',
  rank,
}) => {
  const timeStr = timeAgo(article.publishedAt);
  const label = sectionName(article);
  const badgeClass = BADGE[article.category] || BADGE_DEFAULT;

  // Byline link to the author page. It sits above the card's stretched headline link (relative z-10)
  // so it can be clicked on its own. (Lightweight stubs may have no author: credit the newsdesk.)
  const author = article.author || { name: STAFF_BYLINE, role: '', avatar: '' };
  const bylineHref = authorHref(author);
  const bylineLink = (cls: string) => (
    <SpaLink
      href={bylineHref}
      onNavigate={() => navigateTo(bylineHref)}
      className={`relative z-10 hover:underline underline-offset-2 ${cls}`}
    >
      {author.name}
    </SpaLink>
  );

  const headlineLink = (
    <SpaLink href={articleHref(article)} onNavigate={() => onSelect(article)} className={STRETCHED_LINK}>
      {article.title}
    </SpaLink>
  );

  const time = timeStr ? <time dateTime={article.publishedAt}>{timeStr}</time> : null;

  // 1. LEAD — full-bleed image, dark gradient, big headline (homepage hero, section and author leads)
  if (variant === 'lead' || variant === 'overlay') {
    const isLead = variant === 'lead';
    return (
      <article
        className={`group relative isolate flex h-full overflow-hidden rounded-2xl bg-neutral-900 shadow-card ${
          isLead ? 'min-h-[400px] sm:min-h-[460px] lg:min-h-[540px]' : 'min-h-[240px] sm:min-h-[260px]'
        } ${className}`}
      >
        <div className="absolute inset-0 -z-10">
          <CardImage src={article.heroImage} eager={isLead} className="group-hover:scale-[1.04]" />
        </div>
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/5"
          aria-hidden="true"
        />

        <div className={`mt-auto w-full text-white ${isLead ? 'p-5 sm:p-8 lg:p-10' : 'p-5'}`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {article.isBreaking && <BreakingBadge />}
            <span className="inline-flex items-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1">
              {label}
            </span>
          </div>

          {isLead ? (
            <h2 className="font-display font-extrabold text-[26px] leading-[1.15] sm:text-4xl lg:text-[44px] lg:leading-[1.08] tracking-tight max-w-3xl text-balance group-hover:underline decoration-2 underline-offset-[6px]">
              {headlineLink}
            </h2>
          ) : (
            <h3 className="font-display font-bold text-lg sm:text-xl leading-snug tracking-tight line-clamp-3 text-balance group-hover:underline decoration-2 underline-offset-4">
              {headlineLink}
            </h3>
          )}

          {isLead && article.standfirst && (
            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-white/80 line-clamp-2 sm:line-clamp-3">
              {article.standfirst}
            </p>
          )}

          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-white/75 ${isLead ? 'mt-5 text-[13px]' : 'mt-3 text-xs'}`}>
            {isLead && (
              <>
                {bylineLink('font-semibold text-white')}
                <span aria-hidden="true">·</span>
              </>
            )}
            {time}
            {article.readTime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{article.readTime}</span>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  // 2. TEXT-ONLY HEADLINE
  if (variant === 'text-only') {
    return (
      <article className={`group relative py-3 ${className}`}>
        <div className="flex flex-wrap items-center gap-x-2 mb-1 text-xs">
          <span className="font-semibold text-accent">{label}</span>
          {time && <span className="text-ink-muted">· {time}</span>}
        </div>
        <h3 className="font-display font-semibold text-[15px] leading-snug text-ink group-hover:text-accent transition-colors">
          {headlineLink}
        </h3>
      </article>
    );
  }

  // 3. THUMB LEFT — compact row with rounded thumbnail (lists, tabbed modules)
  if (variant === 'thumb-left') {
    return (
      <article className={`group relative flex gap-3.5 items-start py-3.5 ${className}`}>
        <div className="relative w-24 sm:w-28 aspect-[4/3] shrink-0 overflow-hidden rounded-lg bg-surface-2">
          <CardImage src={article.heroImage} className="group-hover:scale-105" />
          {rank !== undefined && (
            <span
              className="absolute top-1.5 left-1.5 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-black/70 backdrop-blur text-white text-xs font-bold"
              aria-hidden="true"
            >
              {rank}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-1.5 mb-1 text-xs">
            <span className="font-semibold text-accent">{label}</span>
            {time && <span className="text-ink-muted">· {time}</span>}
          </div>
          <h3 className="font-display font-semibold text-[15px] leading-snug text-ink group-hover:text-accent transition-colors line-clamp-3">
            {headlineLink}
          </h3>
          {article.readTime && <p className="mt-1 text-xs text-ink-muted">{article.readTime}</p>}
        </div>
      </article>
    );
  }

  // 4. GRID CARD — image on top, badge, headline, byline and read time
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-xl bg-surface border border-line shadow-card hover:shadow-card-hover hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition duration-300 ${className}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <CardImage src={article.heroImage} className="group-hover:scale-105" />
        {article.isBreaking && (
          <span className="absolute top-3 left-3">
            <BreakingBadge />
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>
            {label}
          </span>
          {time && <span className="text-xs text-ink-muted shrink-0">{time}</span>}
        </div>

        <h3 className="font-display font-bold text-[17px] leading-snug tracking-tight text-ink group-hover:text-accent transition-colors line-clamp-3">
          {headlineLink}
        </h3>

        <div className="mt-auto pt-4 flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span className="truncate min-w-0">{bylineLink('font-medium text-ink-soft hover:text-accent')}</span>
          {article.readTime && <span className="shrink-0">{article.readTime}</span>}
        </div>
      </div>
    </article>
  );
};
