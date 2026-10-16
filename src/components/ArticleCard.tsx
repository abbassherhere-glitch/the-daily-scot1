import React from 'react';
import { Article } from '../types/news';

interface ArticleCardProps {
  article: Article;
  variant?: 'lead' | 'text-only' | 'thumb-left' | 'grid-card';
  onSelect: (article: Article) => void;
  className?: string;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  variant = 'grid-card',
  onSelect,
  className = '',
}) => {
  // Format relative or readable time e.g. "14 mins ago"
  const getTimeAgo = (iso: string) => {
    try {
      const now = new Date();
      const past = new Date(iso);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60 && diffMins > 0) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24 && diffHours > 0) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return 'Today';
    }
  };

  const timeStr = getTimeAgo(article.publishedAt);
  const sectionLabel = article.subcategory || article.category;

  // 1. LEAD STORY (Image Left, Headline Right, smaller, dense)
  if (variant === 'lead') {
    return (
      <article
        onClick={() => onSelect(article)}
        className={`group cursor-pointer bg-white border border-neutral-200 hover:border-neutral-400 transition ${className}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-0">
          {/* Image Left */}
          <div className="sm:col-span-7 aspect-16/10 bg-neutral-100 overflow-hidden relative">
            <img
              src={article.heroImage}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
              loading="eager"
            />
            {article.isBreaking && (
              <span className="absolute top-0 left-0 bg-[#D92525] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                Breaking
              </span>
            )}
          </div>

          {/* Headline & Text Right */}
          <div className="sm:col-span-5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#005EB8]">
                  {sectionLabel}
                </span>
                {article.locationTag && (
                  <span className="text-[11px] text-neutral-500 font-medium">
                    • {article.locationTag}
                  </span>
                )}
              </div>

              <h2 className="font-headline font-bold text-xl sm:text-2xl text-neutral-900 leading-tight group-hover:text-[#005EB8] group-hover:underline transition">
                {article.title}
              </h2>

              <p className="mt-2 text-xs text-neutral-600 line-clamp-3 leading-relaxed font-serif">
                {article.standfirst}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="font-medium text-neutral-700">{article.author.name}</span>
              <span>{timeStr}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // 2. TEXT-ONLY HEADLINE (UK local news density column)
  if (variant === 'text-only') {
    return (
      <article
        onClick={() => onSelect(article)}
        className={`group cursor-pointer py-2.5 border-b border-neutral-200 last:border-b-0 ${className}`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#005EB8]">
            {sectionLabel}
          </span>
          <span className="text-[10px] text-neutral-400">• {timeStr}</span>
        </div>

        <h3 className="font-headline font-bold text-sm text-neutral-900 group-hover:text-[#005EB8] group-hover:underline transition leading-snug">
          {article.title}
        </h3>
      </article>
    );
  }

  // 3. THUMB LEFT (Horizontal row with small 16:9 thumbnail)
  if (variant === 'thumb-left') {
    return (
      <article
        onClick={() => onSelect(article)}
        className={`group cursor-pointer py-3 border-b border-neutral-200 last:border-b-0 flex gap-3 items-start ${className}`}
      >
        <div className="w-28 sm:w-32 aspect-16/10 shrink-0 bg-neutral-100 overflow-hidden">
          <img
            src={article.heroImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#005EB8]">
              {sectionLabel}
            </span>
            <span className="text-[10px] text-neutral-400">• {timeStr}</span>
          </div>

          <h4 className="font-headline font-bold text-sm text-neutral-900 group-hover:text-[#005EB8] group-hover:underline transition leading-snug line-clamp-2">
            {article.title}
          </h4>
        </div>
      </article>
    );
  }

  // 4. STANDARD GRID CARD (Small 16:9 thumbnail, short title, time)
  return (
    <article
      onClick={() => onSelect(article)}
      className={`group cursor-pointer bg-white border border-neutral-200 hover:border-neutral-400 transition flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="aspect-16/10 bg-neutral-100 overflow-hidden relative">
          <img
            src={article.heroImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
          {article.isBreaking && (
            <span className="absolute top-0 left-0 bg-[#D92525] text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5">
              Breaking
            </span>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 mb-1">
            <span className="text-[#005EB8] uppercase tracking-wider font-black">
              {sectionLabel}
            </span>
            <span>•</span>
            <span>{timeStr}</span>
          </div>

          <h3 className="font-headline font-bold text-sm sm:text-base text-neutral-900 group-hover:text-[#005EB8] group-hover:underline transition leading-snug line-clamp-2">
            {article.title}
          </h3>
        </div>
      </div>

      <div className="px-3 pb-3 text-[11px] text-neutral-500 font-medium border-t border-neutral-100 pt-2 flex items-center justify-between">
        <span className="truncate">{article.locationTag || 'Glasgow'}</span>
        <span className="text-neutral-400">{article.readTime}</span>
      </div>
    </article>
  );
};
