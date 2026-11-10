import React, { useEffect, useState } from 'react';
import { Article, CategoryType } from '../types/news';
import { SpaLink } from './SpaLink';
import { timeAgo } from './ArticleCard';

interface NowRow {
  slug: string;
  title: string;
  category: string;
  published_at: string;
  changed_at: string;
}

// D1 returns 'YYYY-MM-DD HH:MM:SS' in UTC
const toIso = (value: string) => (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);

// The strip only has headline data; the app loads the full story when one is opened.
function toStub(row: NowRow): Article {
  return {
    id: row.slug,
    slug: row.slug,
    title: row.title,
    standfirst: '',
    category: row.category as CategoryType,
    publishedAt: toIso(row.published_at),
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

/**
 * "Happening now": a black strip of up to three stories published or changed in the last hour, each with
 * a yellow dot and "Updated <time>". Hidden when nothing qualifies. The server-rendered homepage lists the
 * same stories (functions/utils/homepage.ts).
 */
export const HappeningNow: React.FC<{ onSelectArticle: (article: Article) => void }> = ({ onSelectArticle }) => {
  const [rows, setRows] = useState<NowRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/happening-now');
        if (!res.ok) return;
        const data = (await res.json()) as { articles?: NowRow[] };
        if (mounted) setRows(data.articles || []);
      } catch {
        // offline: keep whatever we had
      }
    };
    load();
    const timer = setInterval(load, 2 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="happening-now-heading" className="on-dark bg-brand-ink text-white">
      <div className="px-4 sm:px-5 py-3 sm:py-4 lg:flex lg:items-start lg:gap-6">
        <h2
          id="happening-now-heading"
          className="shrink-0 text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand lg:pt-3"
        >
          Happening now
        </h2>
        <ul className="flex-1 grid grid-cols-1 lg:grid-cols-3 lg:gap-6 divide-y divide-white/20 lg:divide-y-0">
          {rows.map((row) => (
            <li key={row.slug} className="relative flex items-start gap-3 py-3">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <SpaLink
                  href={`/news/${encodeURIComponent(row.slug)}`}
                  onNavigate={() => onSelectArticle(toStub(row))}
                  className="font-display font-extrabold text-base leading-snug text-white hover:underline decoration-brand decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-['']"
                >
                  {row.title}
                </SpaLink>
                <p className="mt-1 text-xs font-bold text-brand">
                  Updated <time dateTime={toIso(row.changed_at)}>{timeAgo(toIso(row.changed_at)).replace(/^Just now$/, 'just now')}</time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
