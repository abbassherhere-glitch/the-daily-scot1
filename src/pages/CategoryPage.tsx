import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { CATEGORIES } from '../data/mockArticles';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import { SpaLink } from '../components/SpaLink';

interface CategoryPageProps {
  category: CategoryType;
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
}

export const CategoryPage: React.FC<CategoryPageProps> = ({
  category,
  articles,
  onSelectArticle,
  onSelectCategory,
}) => {
  const categoryMeta = CATEGORIES.find((c) => c.id === category) || {
    id: category,
    label: category.toUpperCase(),
    description: `Latest news and updates in ${category}`,
  };

  const categoryArticles = useMemo(() => {
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  // One Glasgow section: no area / tag filter tabs, every story in the section is shown.
  const filteredArticles = categoryArticles;

  const leadStory = filteredArticles[0];
  const remainingStories = filteredArticles.slice(1);

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
            {categoryMeta.label}
          </li>
        </ol>
      </nav>

      {/* Category Section Header (Flat brand bar) */}
      <div className="border-b-4 border-[#0B2545] pb-3">
        <h1 className="font-headline font-black text-3xl sm:text-4xl text-neutral-900 uppercase tracking-tight">
          {categoryMeta.label}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 font-serif mt-1">
          {categoryMeta.description}
        </p>
      </div>

      {/* Leaderboard slot */}
      <AdBanner type="leaderboard" className="my-2" />

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {leadStory && (
            <ArticleCard
              article={leadStory}
              variant="lead"
              onSelect={onSelectArticle}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {remainingStories.map((art) => (
              <ArticleCard
                key={art.id}
                article={art}
                variant="grid-card"
                onSelect={onSelectArticle}
              />
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <AdBanner type="mpu" />

        </aside>
      </div>
    </div>
  );
};
