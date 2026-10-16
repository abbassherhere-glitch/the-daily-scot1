import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Bookmark, 
  Check, 
  MessageSquare, 
  ThumbsUp, 
  Send,
  ChevronRight
} from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import DOMPurify from 'dompurify';

interface ArticlePageProps {
  article: Article;
  allArticles: Article[];
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
  isSaved: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onArticleUpdated?: () => void;
}

export const ArticlePage: React.FC<ArticlePageProps> = ({
  article,
  allArticles,
  onSelectArticle,
  onSelectCategory,
  isSaved,
  onToggleSave,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [liveMostRead, setLiveMostRead] = useState<Article[]>([]);

  useEffect(() => {
    // Record real page view via rate-limited public API
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: article.slug, article_id: article.id }),
    }).catch(() => {});

    // Fetch real most read stories
    fetch('/api/views?type=most-read')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.mostRead && data.mostRead.length > 0) {
          const matched = data.mostRead.map((row: any) => {
            const found = allArticles.find((a) => a.id === row.id || a.slug === row.slug);
            if (found) return found;
            return {
              id: row.id,
              slug: row.slug,
              title: row.title,
              standfirst: row.standfirst,
              category: row.category,
              heroImage: row.hero_image,
              publishedAt: row.published_at,
              views: row.total_views,
            } as Article;
          });
          setLiveMostRead(matched);
        }
      })
      .catch(() => {});
  }, [article.slug, article.id, allArticles]);

  const handleShare = (network: string) => {
    const url = window.location.href;
    const text = `${article.title} - The Daily Scot`;
    if (network === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (network === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (network === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (network === 'copy') {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Formatted date string
  const pubDate = new Date(article.publishedAt);
  const dateFormatted = `${pubDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, ${pubDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;

  // Inline "Read More" stories
  const otherStories = allArticles.filter((a) => a.id !== article.id);
  const inlineReadMore1 = otherStories[0];
  const inlineReadMore2 = otherStories[1];

  // Related stories & Most Read (from real page view tracking)
  const relatedStories = otherStories.slice(0, 3);
  const mostRead = liveMostRead.length > 0 ? liveMostRead : [...allArticles].slice(0, 5);

  return (
    <article className="max-w-7xl mx-auto px-4 py-4 space-y-6 bg-white">
      {/* 1. SECTION LABEL BREADCRUMB */}
      <div className="flex items-center gap-1.5 text-xs uppercase font-black tracking-wider text-[#005EB8] border-b border-neutral-200 pb-2">
        <button
          onClick={() => onSelectCategory('all')}
          className="hover:underline"
        >
          Home
        </button>
        <ChevronRight className="w-3 h-3 text-neutral-400" />
        <button
          onClick={() => onSelectCategory(article.category)}
          className="hover:underline"
        >
          {article.category}
        </button>
        {article.subcategory && (
          <>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span className="text-neutral-600">{article.subcategory}</span>
          </>
        )}
      </div>

      {/* 2. HEADLINE & STANDFIRST */}
      <div className="max-w-4xl space-y-3">
        <h1 className="font-headline font-black text-2xl sm:text-3xl lg:text-4xl text-neutral-900 leading-tight">
          {article.title}
        </h1>

        <p className="text-base sm:text-lg text-neutral-700 font-serif italic leading-snug">
          {article.standfirst}
        </p>

        {/* 3. BYLINE & TIMESTAMP ROW */}
        <div className="py-2.5 border-y border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
          <div className="flex items-center gap-3">
            {article.author.avatar ? (
              <img
                src={article.author.avatar}
                alt={article.author.name}
                className="w-9 h-9 rounded-full object-cover border border-neutral-300"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#0B2545] text-white flex items-center justify-center font-bold text-sm">
                {article.author.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-bold text-neutral-900">
                By {article.author.name}
              </div>
              <div className="text-[11px] text-neutral-500">
                {article.author.role}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500">
            <span>Published: {dateFormatted}</span>
          </div>
        </div>

        {/* 4. SHARE BUTTONS ROW */}
        <div className="flex items-center gap-2 pt-1 pb-2 border-b border-neutral-200 text-xs">
          <span className="text-[10px] uppercase font-bold text-neutral-500 mr-1">Share:</span>
          <button
            onClick={() => handleShare('facebook')}
            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition"
          >
            Facebook
          </button>
          <button
            onClick={() => handleShare('twitter')}
            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition"
          >
            X (Twitter)
          </button>
          <button
            onClick={() => handleShare('whatsapp')}
            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition"
          >
            WhatsApp
          </button>
          <button
            onClick={() => handleShare('copy')}
            className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold border border-neutral-300 transition flex items-center gap-1"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
            <span>{copiedLink ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={(e) => onToggleSave(article.id, e)}
            className="ml-auto px-2.5 py-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 flex items-center gap-1 font-semibold"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-neutral-800' : ''}`} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* 5. MAIN CONTENT + SIDEBAR MPU */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Article Body Column (8 cols, max-w-[680px]) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Main Hero Image */}
          <div className="space-y-1.5">
            <div className="aspect-16/10 bg-neutral-100 overflow-hidden border border-neutral-200">
              <img
                src={article.heroImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
            <figcaption className="text-xs text-neutral-500 font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>{article.heroCaption}</span>
              {(article.heroCredit || (article as any).photoCredit) && (
                <span className="font-semibold shrink-0 text-neutral-400">
                  {article.heroCredit || `Photograph: ${(article as any).photoCredit}`}
                </span>
              )}
            </figcaption>
          </div>

          {/* Body Paragraphs with Inline "Read More" Links */}
          <div className="max-w-[680px] space-y-4 text-[18px] leading-[1.65] font-serif text-neutral-900">
            {article.content.map((para, i) => (
              <React.Fragment key={i}>
                <div
                  className="article-body-segment [&>p]:mb-4 [&>h2]:font-sans [&>h2]:font-bold [&>h2]:text-2xl [&>h2]:text-neutral-900 [&>h2]:mt-6 [&>h2]:mb-2 [&>h3]:font-sans [&>h3]:font-bold [&>h3]:text-xl [&>h3]:text-neutral-900 [&>h3]:mt-5 [&>h3]:mb-2 [&>a]:text-[#005EB8] [&>a]:underline [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-3 [&>blockquote]:border-l-4 [&>blockquote]:border-neutral-800 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-4"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(para, {
                      ALLOWED_TAGS: [
                        'p', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'a',
                        'ul', 'ol', 'li', 'blockquote', 'figure', 'figcaption', 'img', 'br'
                      ],
                      ALLOWED_ATTR: ['href', 'rel', 'target', 'src', 'alt', 'title']
                    })
                  }}
                />

                {/* Inline 'READ MORE' link after paragraph 1 */}
                {i === 1 && inlineReadMore1 && (
                  <div className="my-5 p-3 bg-neutral-50 border-l-4 border-[#005EB8] not-italic font-sans text-xs">
                    <span className="font-black uppercase tracking-wider text-[#005EB8] mr-2">
                      READ MORE:
                    </span>
                    <button
                      onClick={() => onSelectArticle(inlineReadMore1)}
                      className="font-bold text-neutral-900 hover:text-[#005EB8] hover:underline text-left"
                    >
                      {inlineReadMore1.title}
                    </button>
                  </div>
                )}

                {/* Pull quote if available */}
                {i === 2 && article.pullQuote && (
                  <blockquote className="my-6 p-4 border-l-4 border-neutral-800 bg-neutral-50 not-italic">
                    <p className="font-serif italic font-bold text-lg text-neutral-900">
                      "{article.pullQuote.text}"
                    </p>
                    <cite className="block mt-1 font-sans text-xs font-bold uppercase tracking-wider text-neutral-600 not-italic">
                      — {article.pullQuote.attribution}
                    </cite>
                  </blockquote>
                )}

                {/* Inline 'READ MORE' link after paragraph 3 */}
                {i === 3 && inlineReadMore2 && (
                  <div className="my-5 p-3 bg-neutral-50 border-l-4 border-[#005EB8] not-italic font-sans text-xs">
                    <span className="font-black uppercase tracking-wider text-[#005EB8] mr-2">
                      READ MORE:
                    </span>
                    <button
                      onClick={() => onSelectArticle(inlineReadMore2)}
                      className="font-bold text-neutral-900 hover:text-[#005EB8] hover:underline text-left"
                    >
                      {inlineReadMore2.title}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Tags */}
          <div className="pt-4 border-t border-neutral-200 max-w-[680px]">
            <span className="text-xs font-bold uppercase text-neutral-500 mr-2">Tags:</span>
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {article.tags.map((t) => (
                <span
                  key={t}
                  className="bg-neutral-100 text-neutral-800 text-xs px-2.5 py-0.5 border border-neutral-300 font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols) with MPU Ad Slot and Trending News */}
        <aside className="lg:col-span-4 space-y-6">
          <AdBanner type="mpu" />

          {/* Trending in Glasgow list */}
          <div className="border border-neutral-200 p-4">
            <h4 className="font-headline font-black text-sm uppercase tracking-wider text-neutral-900 border-b-2 border-neutral-900 pb-1.5 mb-3">
              Trending Stories
            </h4>
            <div className="divide-y divide-neutral-200">
              {otherStories.slice(0, 4).map((art) => (
                <div
                  key={art.id}
                  onClick={() => onSelectArticle(art)}
                  className="py-2.5 cursor-pointer group"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#005EB8] block mb-0.5">
                    {art.subcategory || art.category}
                  </span>
                  <h5 className="font-headline font-bold text-xs text-neutral-900 group-hover:text-[#005EB8] group-hover:underline line-clamp-2">
                    {art.title}
                  </h5>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* 6. MORE ON THIS STORY (Bottom 3-column grid) */}
      <section className="pt-6 border-t-4 border-[#0B2545]">
        <h3 className="font-headline font-black text-xl text-neutral-900 uppercase tracking-tight mb-4">
          More on this story
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {relatedStories.map((rel) => (
            <ArticleCard
              key={rel.id}
              article={rel}
              variant="grid-card"
              onSelect={onSelectArticle}
            />
          ))}
        </div>
      </section>

      {/* 7. MOST READ SIMPLE LIST AT BOTTOM */}
      <section className="pt-6 border-t border-neutral-300">
        <h3 className="font-headline font-black text-xl text-neutral-900 uppercase tracking-tight mb-3">
          Most Read Across Glasgow
        </h3>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {mostRead.map((item, idx) => (
            <li
              key={item.id}
              onClick={() => onSelectArticle(item)}
              className="p-3 border border-neutral-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <span className="font-headline font-black text-2xl text-neutral-300 group-hover:text-[#005EB8]">
                  #{idx + 1}
                </span>
                <span className="text-[10px] font-bold uppercase text-[#005EB8] block mt-1">
                  {item.subcategory || item.category}
                </span>
                <h4 className="font-headline font-bold text-xs text-neutral-900 group-hover:underline line-clamp-3 mt-1">
                  {item.title}
                </h4>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Bottom Leaderboard */}
      <AdBanner type="leaderboard" className="mt-8" />
    </article>
  );
};
