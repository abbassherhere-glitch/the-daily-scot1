import React from 'react';
import { Article } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { SpaLink, STAFF_BYLINE, articleHref, authorHref, navigateTo } from './SpaLink';
import { StoryLabels } from './BlockLabel';

export type ArticleCardVariant = 'lead' | 'overlay' | 'grid-card' | 'thumb-left' | 'text-only';

interface ArticleCardProps {
  article: Article;
  variant?: ArticleCardVariant;
  onSelect: (article: Article) => void;
  className?: string;
  /** thumb-left only: show a ranking number on the thumbnail (Most Read lists) */
  rank?: number;
  /** lead only: on large screens, stretch the picture so the card fills its column's height */
  fillHeight?: boolean;
}

const PLACEHOLDER = '/placeholder-hero.svg';

// The headline link covers the whole card (so the card stays clickable) while keeping a single,
// properly named link for keyboard and screen-reader users.
const STRETCHED_LINK =
  "after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-ink focus-visible:after:outline-offset-2";
const STRETCHED_LINK_ON_DARK =
  "after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-brand focus-visible:after:outline-offset-2";

/** Section name for display, e.g. "whats-on" -> "What's On". */
export function sectionName(article: Pick<Article, 'category' | 'subcategory'>): string {
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

/**
 * Photo ratios are the same everywhere so rows of cards line up:
 *   lead photos 16:9, card photos 16:10, small thumbnails 4:3.
 */
const CardImage: React.FC<{ src: string; eager?: boolean }> = ({ src, eager }) => (
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
    className="w-full h-full object-cover"
  />
);

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  variant = 'grid-card',
  onSelect,
  className = '',
  rank,
  fillHeight = false,
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

  const headlineLink = (onDark = false) => (
    <SpaLink
      href={articleHref(article)}
      onNavigate={() => onSelect(article)}
      className={onDark ? STRETCHED_LINK_ON_DARK : STRETCHED_LINK}
    >
      {article.title}
    </SpaLink>
  );

  const time = timeStr ? <time dateTime={article.publishedAt}>{timeStr}</time> : null;

  // 1. LEAD: large photo with the headline on a solid black panel that overlaps the bottom of it
  if (variant === 'lead') {
    return (
      <article className={`ds-lift group relative ${fillHeight ? 'lg:flex lg:flex-col lg:h-full' : ''} ${className}`}>
        <div
          className={`relative overflow-hidden bg-surface-2 aspect-[16/9] ${
            fillHeight ? 'lg:aspect-auto lg:flex-1 lg:min-h-[300px] lg:[&>img]:absolute lg:[&>img]:inset-0' : ''
          }`}
        >
          <CardImage src={article.heroImage} eager />
        </div>

        <div className="on-dark relative -mt-8 sm:-mt-14 mr-4 sm:mr-16 bg-brand-ink text-white p-4 sm:p-6">
          <StoryLabels section={label} area={article.locationTag} breaking={article.isBreaking} onDark className="mb-3" />

          <h2 className="font-display font-extrabold text-[26px] leading-[1.1] sm:text-[34px] lg:text-[40px] lg:leading-[1.05] text-white text-balance group-hover:underline decoration-brand decoration-4 underline-offset-[6px]">
            {headlineLink(true)}
          </h2>

          {article.standfirst && (
            <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-neutral-200 line-clamp-3 max-w-3xl">
              {article.standfirst}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-300">
            {bylineLink('font-bold text-white')}
            {time && (
              <>
                <span aria-hidden="true">·</span>
                {time}
              </>
            )}
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
      <article className={`ds-lift group relative py-3 ${className}`}>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <StoryLabels section={label} area={article.locationTag} />
          {time && <span className="text-xs text-ink-muted">{time}</span>}
        </div>
        <h3 className="font-display font-extrabold text-base leading-snug text-ink group-hover:underline decoration-2 underline-offset-4">
          {headlineLink()}
        </h3>
      </article>
    );
  }

  // 3. THUMB LEFT: compact row with a small photo (lists, tabbed modules)
  if (variant === 'thumb-left') {
    return (
      <article className={`ds-lift group relative flex gap-3.5 items-start py-3.5 ${className}`}>
        <div className="relative w-24 sm:w-28 aspect-[4/3] shrink-0 overflow-hidden bg-surface-2">
          <CardImage src={article.heroImage} />
          {rank !== undefined && (
            <span
              className={`absolute top-0 left-0 inline-flex items-center justify-center w-7 h-7 text-sm font-extrabold ${
                rank === 1 ? 'bg-brand text-brand-ink' : 'bg-brand-ink text-white'
              }`}
              aria-hidden="true"
            >
              {rank}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <StoryLabels section={label} area={article.locationTag} breaking={article.isBreaking} className="mb-1.5" />
          <h3 className="font-display font-extrabold text-base leading-snug text-ink group-hover:underline decoration-2 underline-offset-4 line-clamp-3">
            {headlineLink()}
          </h3>
          {time && <p className="mt-1 text-xs text-ink-muted">{time}</p>}
        </div>
      </article>
    );
  }

  // 4. CARD ('grid-card', and 'overlay' for the secondary stories beside a lead): photo, labels, headline
  const secondary = variant === 'overlay';
  return (
    <article className={`ds-lift group relative flex flex-col ${className}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <CardImage src={article.heroImage} />
      </div>

      <div className="flex flex-col flex-1 pt-3">
        <StoryLabels section={label} area={article.locationTag} breaking={article.isBreaking} className="mb-2" />

        <h3
          className={`font-display font-extrabold leading-[1.2] text-ink group-hover:underline decoration-2 underline-offset-4 line-clamp-4 ${
            secondary ? 'text-xl' : 'text-xl sm:text-[22px]'
          }`}
        >
          {headlineLink()}
        </h3>

        <div className="mt-auto pt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {bylineLink('font-bold text-ink-soft')}
          {time && (
            <>
              <span aria-hidden="true">·</span>
              {time}
            </>
          )}
        </div>
      </div>
    </article>
  );
};
