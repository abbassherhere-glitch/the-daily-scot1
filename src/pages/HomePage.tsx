import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import { SpaLink, articleHref, categoryHref } from '../components/SpaLink';

interface HomePageProps {
  articles: Article[];
  selectedArea?: string;
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  articles,
  selectedArea,
  onSelectArticle,
  onSelectCategory,
}) => {
  // Filter by selected area if any
  const filteredList = useMemo(() => {
    if (!selectedArea || selectedArea === 'All') return articles;
    return articles.filter(
      (a) =>
        a.locationTag?.toLowerCase() === selectedArea.toLowerCase() ||
        a.tags.some((t) => t.toLowerCase() === selectedArea.toLowerCase())
    );
  }, [articles, selectedArea]);

  const pool = filteredList.length >= 4 ? filteredList : articles;

  // 1. Lead Story
  const leadStory = pool.find((a) => a.isFeaturedLead) || pool[0];

  // 2. Text-only column stories (4-5 stories)
  const textColumnStories = pool.filter((a) => a.id !== leadStory?.id).slice(0, 5);

  // 3. Next 6 grid stories
  const midGridStories = pool
    .filter((a) => a.id !== leadStory?.id && !textColumnStories.some((t) => t.id === a.id))
    .slice(0, 6);

  // 4. Section specific slices
  const glasgowSection = pool.filter((a) => a.category === 'glasgow' || a.category === 'news').slice(0, 4);
  const sportSection = pool.filter((a) => a.category === 'sport').slice(0, 4);
  const propertySection = pool.filter((a) => a.category === 'property' || a.category === 'business').slice(0, 4);

  // 5. Most Read list (sorted by views or position)
  const mostRead = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-6">
      <h1 className="sr-only">The Daily Scot – latest news from Glasgow and Scotland</h1>

      {/* Top Leaderboard Slot */}
      <AdBanner type="leaderboard" className="my-2" />

      {/* Area filter notice if active */}
      {selectedArea && selectedArea !== 'All' && (
        <div className="bg-neutral-100 border-l-4 border-[#005EB8] px-3 py-1.5 text-xs font-bold text-neutral-800 flex items-center justify-between">
          <span>Showing news for: {selectedArea}</span>
          <span className="text-neutral-600 font-normal">{filteredList.length} stories</span>
        </div>
      )}

      {/* SECTION 1: ABOVE THE FOLD DENSE HERO & TEXT COLUMN */}
      <section className="border-b border-neutral-300 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main Lead Story (8 cols) */}
          <div className="lg:col-span-8">
            {leadStory && (
              <ArticleCard
                article={leadStory}
                variant="lead"
                onSelect={onSelectArticle}
              />
            )}
          </div>

          {/* Column of 4-5 Text-Only Headlines (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-neutral-200 p-3.5 flex flex-col justify-between">
            <div>
              <div className="border-b-2 border-[#0B2545] pb-1.5 mb-2 flex items-center justify-between">
                <h2 className="font-headline font-black text-xs uppercase tracking-wider text-neutral-900">
                  Latest Headlines
                </h2>
                <span className="text-[10px] text-neutral-600 font-semibold uppercase">Updated live</span>
              </div>

              <div className="divide-y divide-neutral-200">
                {textColumnStories.map((art) => (
                  <ArticleCard
                    key={art.id}
                    article={art}
                    variant="text-only"
                    onSelect={onSelectArticle}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: 3-COLUMN DESKTOP GRID (Rows of story blocks) */}
      <section className="border-b border-neutral-300 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {midGridStories.map((art) => (
            <ArticleCard
              key={art.id}
              article={art}
              variant="grid-card"
              onSelect={onSelectArticle}
            />
          ))}
        </div>
      </section>

      {/* SECTION 3: GLASGOW NEWS SECTION BLOCK (Coloured top border) */}
      <section className="border-t-4 border-[#0B2545] pt-3">
        <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-1.5">
          <div className="flex items-center gap-2">
            <h2 className="font-headline font-black text-xl sm:text-2xl text-neutral-900 uppercase tracking-tight">
              Glasgow News
            </h2>
          </div>
          <SpaLink
            href={categoryHref('glasgow')}
            onNavigate={() => onSelectCategory('glasgow')}
            className="text-xs font-bold text-[#005EB8] hover:underline flex items-center gap-0.5 py-1"
          >
            <span>See more<span className="sr-only"> Glasgow news</span></span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </SpaLink>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main 3 columns of Glasgow stories */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {glasgowSection.map((art) => (
                <ArticleCard
                  key={art.id}
                  article={art}
                  variant="thumb-left"
                  onSelect={onSelectArticle}
                />
              ))}
            </div>
          </div>

          {/* MPU Ad in Right Column */}
          <div className="lg:col-span-4 flex items-center justify-center">
            <AdBanner type="mpu" />
          </div>
        </div>
      </section>

      {/* Mid-Page Leaderboard */}
      <AdBanner type="leaderboard" />

      {/* SECTION 4: SCOTTISH SPORT SECTION BLOCK */}
      <section className="border-t-4 border-[#005EB8] pt-3">
        <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-1.5">
          <h2 className="font-headline font-black text-xl sm:text-2xl text-neutral-900 uppercase tracking-tight">
            Scottish Sport
          </h2>
          <SpaLink
            href={categoryHref('sport')}
            onNavigate={() => onSelectCategory('sport')}
            className="text-xs font-bold text-[#005EB8] hover:underline flex items-center gap-0.5 py-1"
          >
            <span>All Sport<span className="sr-only"> news</span></span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </SpaLink>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sportSection.map((art) => (
            <ArticleCard
              key={art.id}
              article={art}
              variant="grid-card"
              onSelect={onSelectArticle}
            />
          ))}
        </div>
      </section>

      {/* SECTION 5: PROPERTY & MOST READ DUAL BLOCK */}
      <section className="border-t-4 border-neutral-800 pt-3 border-b border-neutral-300 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Property Block (8 cols) */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-1.5">
              <h2 className="font-headline font-black text-xl text-neutral-900 uppercase tracking-tight">
                Property & Homes
              </h2>
              <SpaLink
                href={categoryHref('property')}
                onNavigate={() => onSelectCategory('property')}
                className="text-xs font-bold text-[#005EB8] hover:underline py-1"
              >
                More Property →
              </SpaLink>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {propertySection.map((art) => (
                <ArticleCard
                  key={art.id}
                  article={art}
                  variant="thumb-left"
                  onSelect={onSelectArticle}
                />
              ))}
            </div>
          </div>

          {/* MOST READ SIMPLE NUMBERED LIST (No box - exactly like Glasgow Times / MEN) */}
          <div className="lg:col-span-4">
            <div className="border-b-2 border-neutral-900 pb-1.5 mb-3">
              <h2 className="font-headline font-black text-lg text-neutral-900 uppercase tracking-tight">
                Most Read
              </h2>
            </div>

            <ol className="divide-y divide-neutral-200">
              {mostRead.map((item, idx) => (
                <li key={item.id} className="relative py-2.5 flex items-start gap-3 cursor-pointer group">
                  <span
                    className="font-headline font-black text-2xl text-neutral-500 group-hover:text-[#005EB8] leading-none shrink-0 w-6"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-[#005EB8] block mb-0.5">
                      {item.subcategory || item.category}
                    </span>
                    <h3 className="font-headline font-bold text-xs sm:text-sm text-neutral-900 group-hover:text-[#005EB8] group-hover:underline transition leading-snug line-clamp-2">
                      <SpaLink
                        href={articleHref(item)}
                        onNavigate={() => onSelectArticle(item)}
                        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-[#005EB8]"
                      >
                        {item.title}
                      </SpaLink>
                    </h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
};
