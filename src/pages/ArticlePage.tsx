import React, { useState, useEffect } from 'react';
import { Share2, Bookmark, Check } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard, sectionName } from '../components/ArticleCard';
import { BLOCK_LABEL, BlockLabel } from '../components/BlockLabel';
import { markQuestionHeadings } from '../config/storyBlocks';
import { formatUkDateTime, shownUpdateIso } from '../config/updates';
import { AdBanner } from '../components/AdBanner';
import { SpaLink, articleHref, authorHref, categoryHref, navigateTo } from '../components/SpaLink';
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

const STRETCHED_LINK =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-ink";

const SHARE_BUTTON =
  'inline-flex items-center justify-center gap-1.5 h-11 px-3.5 bg-surface border-2 border-ink text-ink text-sm font-bold hover:bg-brand';

const READ_MORE_BOX = 'my-6 border-y-2 border-ink py-3 font-sans text-base';

/** Stories shown under "More on <section>" (the server-rendered page lists the same number) */
const MORE_ON_SECTION = 3;

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
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    } else if (network === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    } else if (network === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener,noreferrer');
    } else if (network === 'copy') {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Formatted date string
  const pubDate = new Date(article.publishedAt);
  const dateFormatted = `${pubDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, ${pubDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;

  const sectionLabel = sectionName(article);
  // Shown only when the story's words changed more than half an hour after it was published
  const updatedIso = shownUpdateIso(article.publishedAt, article.contentUpdatedAt);

  // Inline "Read more" links: the two newest other stories
  const otherStories = allArticles.filter((a) => a.id !== article.id);
  const inlineReadMore1 = otherStories[0];
  const inlineReadMore2 = otherStories[1];

  // "More on <section>": the newest other stories from this story's own section
  const moreOnSection = otherStories.filter((a) => a.category === article.category).slice(0, MORE_ON_SECTION);
  // Most read comes from real page-view tracking
  const mostRead = (liveMostRead.length > 0 ? liveMostRead : [...allArticles]).slice(0, 5);

  const readMore = (story: Article) => (
    <div className={READ_MORE_BOX}>
      <BlockLabel className="mr-2 align-middle">Read more</BlockLabel>
      <SpaLink
        href={articleHref(story)}
        onNavigate={() => onSelectArticle(story)}
        className="font-bold text-ink underline decoration-2 underline-offset-4 hover:decoration-4"
      >
        {story.title}
      </SpaLink>
    </div>
  );

  return (
    <article className="max-w-7xl mx-auto pb-6">
      {/* 1. LEAD PHOTO, full width, with the headline on a black panel overlapping the bottom of it */}
      <div className="bg-surface-2 aspect-[16/10] sm:aspect-[2/1] lg:aspect-[21/9] overflow-hidden">
        <img
          src={article.heroImage}
          alt={article.heroCaption ? '' : article.title}
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="on-dark relative -mt-10 sm:-mt-20 lg:-mt-28 mr-4 sm:mx-6 lg:max-w-4xl bg-brand-ink text-white px-4 py-5 sm:p-8">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <SpaLink
                href="/"
                onNavigate={() => onSelectCategory('all')}
                className={`${BLOCK_LABEL} bg-white text-brand-ink hover:bg-brand`}
              >
                Home
              </SpaLink>
            </li>
            <li>
              <SpaLink
                href={categoryHref(article.category)}
                onNavigate={() => onSelectCategory(article.category)}
                className={`${BLOCK_LABEL} bg-brand text-brand-ink hover:bg-white`}
              >
                {sectionLabel}
              </SpaLink>
            </li>
            {article.locationTag && article.locationTag.toLowerCase() !== sectionLabel.toLowerCase() && (
              <li>
                <BlockLabel tone="area-inv">{article.locationTag}</BlockLabel>
              </li>
            )}
            {article.isBreaking && (
              <li>
                <BlockLabel tone="alert">Breaking</BlockLabel>
              </li>
            )}
          </ol>
        </nav>

        <h1 className="font-headline font-extrabold text-[28px] leading-[1.1] sm:text-4xl lg:text-5xl lg:leading-[1.05] text-white text-balance">
          {article.title}
        </h1>

        {article.standfirst && (
          <p className="mt-3 text-base sm:text-lg text-neutral-200 leading-snug max-w-3xl">{article.standfirst}</p>
        )}
      </div>

      <div className="px-4 sm:px-6 space-y-6">
        {(article.heroCaption || article.heroCredit) && (
          <p className="mt-2 text-xs text-ink-muted">
            {article.heroCaption}
            {article.heroCaption && article.heroCredit ? ' · ' : ''}
            {article.heroCredit && <span className="font-semibold">{article.heroCredit}</span>}
          </p>
        )}

        {/* 2. BYLINE ROW, with a 2px black rule under it */}
        <div className="pt-2 pb-3 border-b-2 border-ink flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <div className="flex items-center gap-3">
            {article.author.avatar ? (
              <img src={article.author.avatar} alt="" className="w-11 h-11 object-cover bg-surface-2" />
            ) : (
              <div className="w-11 h-11 bg-brand text-brand-ink flex items-center justify-center font-extrabold text-lg" aria-hidden="true">
                {article.author.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-bold text-ink">
                By{' '}
                <SpaLink
                  href={authorHref(article.author)}
                  onNavigate={() => navigateTo(authorHref(article.author))}
                  className="underline decoration-2 underline-offset-2 hover:decoration-4"
                >
                  {article.author.name}
                </SpaLink>
              </div>
              <div className="text-xs text-ink-muted">{article.author.role}</div>
            </div>
          </div>

          <div className="text-xs text-ink-muted sm:text-right">
            <div>Published: <time dateTime={article.publishedAt}>{dateFormatted}</time></div>
            {updatedIso && (
              <div className="mt-1 font-bold text-ink">
                Updated: <time dateTime={updatedIso}>{formatUkDateTime(updatedIso)}</time>
              </div>
            )}
          </div>
        </div>

        {/* 3. SHARE BUTTONS ROW (wraps on narrow screens) */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <span id="share-label" className="text-xs uppercase font-extrabold tracking-wider text-ink mr-1">Share</span>
          <div role="group" aria-labelledby="share-label" className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => handleShare('facebook')} aria-label="Share on Facebook (opens in a new window)" className={SHARE_BUTTON}>
              Facebook
            </button>
            <button type="button" onClick={() => handleShare('twitter')} aria-label="Share on X, formerly Twitter (opens in a new window)" className={SHARE_BUTTON}>
              X
            </button>
            <button type="button" onClick={() => handleShare('whatsapp')} aria-label="Share on WhatsApp (opens in a new window)" className={SHARE_BUTTON}>
              WhatsApp
            </button>
            <button type="button" onClick={() => handleShare('copy')} aria-label="Copy link to this story" className={SHARE_BUTTON}>
              {copiedLink ? <Check className="w-4 h-4" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
              <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {copiedLink ? 'Link copied to clipboard' : ''}
          </span>

          <button
            type="button"
            onClick={(e) => onToggleSave(article.id, e)}
            aria-pressed={isSaved}
            className={`sm:ml-auto ${SHARE_BUTTON} ${isSaved ? 'bg-brand!' : ''}`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-ink' : ''}`} aria-hidden="true" />
            <span>{isSaved ? 'Saved' : 'Save story'}</span>
          </button>
        </div>

        {/* 4. STORY + SIDEBAR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {/* Key facts: solid yellow block, black text */}
            {article.keyFacts && article.keyFacts.length > 0 && (
              <aside aria-label={article.keyFactsHeading || 'Key facts'} className="max-w-[680px] bg-brand text-brand-ink p-5 sm:p-6">
                <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em] border-b-2 border-brand-ink pb-2 mb-3">
                  {article.keyFactsHeading || 'Key facts'}
                </h2>
                <ul className="list-[square] pl-5 space-y-2 text-base sm:text-[17px] font-medium leading-snug">
                  {article.keyFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </aside>
            )}

            {/* Story text with inline "Read more" links */}
            <div className="max-w-[680px] text-[18px] leading-[1.65] text-ink">
              {article.content.map((para, i) => (
                <React.Fragment key={i}>
                  <div
                    className="story-body"
                    dangerouslySetInnerHTML={{
                      __html: markQuestionHeadings(
                        DOMPurify.sanitize(para, {
                          ALLOWED_TAGS: [
                            'p', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'a',
                            'ul', 'ol', 'li', 'blockquote', 'figure', 'figcaption', 'img', 'br'
                          ],
                          ALLOWED_ATTR: ['href', 'rel', 'target', 'src', 'alt', 'title']
                        }),
                      ),
                    }}
                  />

                  {i === 1 && inlineReadMore1 && readMore(inlineReadMore1)}

                  {/* Pull quote if available */}
                  {i === 2 && article.pullQuote && (
                    <blockquote className="my-6 bg-brand-ink text-white p-5">
                      <p className="font-headline font-extrabold text-xl leading-snug">
                        &ldquo;{article.pullQuote.text}&rdquo;
                      </p>
                      <cite className="block mt-2 text-xs font-bold uppercase tracking-wider text-brand not-italic">
                        {article.pullQuote.attribution}
                      </cite>
                    </blockquote>
                  )}

                  {i === 3 && inlineReadMore2 && readMore(inlineReadMore2)}
                </React.Fragment>
              ))}
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="pt-4 border-t-2 border-ink max-w-[680px] flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink mr-1">Tags</span>
                {article.tags.map((t) => (
                  <span key={t} className="bg-surface border border-line-strong text-ink text-xs px-2.5 py-1 font-semibold">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: advert and Most read */}
          <aside className="lg:col-span-4 space-y-8">
            <AdBanner type="mpu" />

            {mostRead.length > 0 && (
              <section aria-labelledby="most-read-heading">
                <div className="border-b-[3px] border-ink mb-1">
                  <h2 id="most-read-heading" className="inline-block bg-brand text-brand-ink px-3 py-1.5 font-headline font-extrabold text-base uppercase">
                    Most read
                  </h2>
                </div>
                <ol>
                  {mostRead.map((item, idx) => (
                    <li key={item.id} className="group relative flex items-start gap-3 py-3 border-b border-line">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 font-headline font-extrabold text-xl ${
                          idx === 0 ? 'bg-brand text-brand-ink' : 'bg-brand-ink text-white'
                        }`}
                        aria-hidden="true"
                      >
                        {idx + 1}
                      </span>
                      <h3 className="font-headline font-extrabold text-base leading-snug text-ink group-hover:underline decoration-2 underline-offset-4">
                        <SpaLink href={articleHref(item)} onNavigate={() => onSelectArticle(item)} className={STRETCHED_LINK}>
                          {item.title}
                        </SpaLink>
                      </h3>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </aside>
        </div>

        {/* 5. MORE ON <SECTION>: three cards with photos */}
        {moreOnSection.length > 0 && (
          <section aria-labelledby="more-on-heading" className="pt-2">
            <div className="border-b-[3px] border-ink mb-5">
              <h2 id="more-on-heading" className="inline-block bg-brand text-brand-ink px-3 py-1.5 font-headline font-extrabold text-xl uppercase">
                More on {sectionLabel}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-8">
              {moreOnSection.map((rel) => (
                <ArticleCard key={rel.id} article={rel} variant="grid-card" onSelect={onSelectArticle} />
              ))}
            </div>
          </section>
        )}

        {/* Bottom advert */}
        <AdBanner type="leaderboard" className="mt-8" />
      </div>
    </article>
  );
};
