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

  // 1. LEAD / FEATURE — open layout: picture, then headline and text straight on the page (no box)
  if (variant === 'lead' || variant === 'overlay') {
    const isLead = variant === 'lead';
    return (
      <article className={`group relative ${className}`}>
        <div className={`relative overflow-hidden bg-surface-2 ${isLead ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
          <CardImage src={article.heroImage} eager={isLead} className="group-hover:scale-[1.03]" />
          {article.isBreaking && (
            <span className="absolute top-3 left-3">
              <BreakingBadge />
            </span>
          )}
        </div>

        <div className={isLead ? 'pt-4 sm:pt-5' : 'pt-3'}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-accent">{label}</p>

          {isLead ? (
            <h2 className="font-display font-extrabold text-[26px] leading-[1.15] sm:text-[34px] lg:text-[40px] lg:leading-[1.1] tracking-tight text-ink text-balance group-hover:underline decoration-2 underline-offset-[6px]">
              {headlineLink}
            </h2>
          ) : (
            <h3 className="font-display font-bold text-lg sm:text-xl leading-snug tracking-tight text-ink text-balance group-hover:underline decoration-2 underline-offset-4">
              {headlineLink}
            </h3>
          )}

          {article.standfirst && (
            <p
              className={`mt-2 leading-relaxed text-ink-soft ${
                isLead ? 'text-base sm:text-lg line-clamp-3 max-w-3xl' : 'text-sm line-clamp-2'
              }`}
            >
              {article.standfirst}
            </p>
          )}

          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted ${isLead ? 'mt-3 text-[13px]' : 'mt-2 text-xs'}`}>
            {isLead && (
              <>
                {bylineLink('font-semibold text-ink-soft hover:text-accent')}
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

  // 4. GRID CARD — open layout: picture, then section, headline, byline and read time on the page (no box)
  return (
    <article className={`group relative flex flex-col ${className}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <CardImage src={article.heroImage} className="group-hover:scale-[1.04]" />
        {article.isBreaking && (
          <span className="absolute top-3 left-3">
            <BreakingBadge />
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 pt-3">
        <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
          <span className="font-bold uppercase tracking-wider text-accent">{label}</span>
          {time && <span className="text-ink-muted shrink-0">{time}</span>}
        </div>

        <h3 className="font-display font-bold text-[18px] leading-snug tracking-tight text-ink group-hover:underline decoration-2 underline-offset-4 line-clamp-3">
          {headlineLink}
        </h3>

        <div className="mt-auto pt-2.5 flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span className="truncate min-w-0">{bylineLink('font-medium text-ink-soft hover:text-accent')}</span>
          {article.readTime && <span className="shrink-0">{article.readTime}</span>}
        </div>
      </div>
    </article>
  );
};
