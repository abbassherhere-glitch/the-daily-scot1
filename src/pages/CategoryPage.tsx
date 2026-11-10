import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { CATEGORIES } from '../data/mockArticles';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';
import { SpaLink } from '../components/SpaLink';
import { sectionHeading } from '../config/seoText';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-6 sm:pb-8 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-xs uppercase font-extrabold tracking-wider text-ink">
          <li>
            <SpaLink
              href="/"
              onNavigate={() => onSelectCategory('all')}
              className="inline-flex items-center min-h-11 underline decoration-2 underline-offset-4 hover:decoration-4"
            >
              Home
            </SpaLink>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-3 h-3 text-ink-muted" />
          </li>
          <li className="text-ink-muted" aria-current="page">
            {categoryMeta.label}
          </li>
        </ol>
      </nav>

      {/* Section heading: yellow block sitting on a thick black rule */}
      <div>
        <div className="border-b-4 border-ink">
          <h1 className="inline-block bg-brand text-brand-ink px-3 sm:px-4 py-2 font-display font-extrabold text-3xl sm:text-[44px] sm:leading-[1.1] uppercase">
            {sectionHeading(category, categoryMeta.label)}
          </h1>
        </div>
        <p className="text-base text-ink-soft mt-3 max-w-3xl">{categoryMeta.description}</p>
      </div>

      {/* Leaderboard slot */}
      <div>
        <AdBanner type="leaderboard" className="my-0!" />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {leadStory && (
            <ArticleCard
              article={leadStory}
              variant="lead"
              onSelect={onSelectArticle}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10 border-t-[3px] border-ink pt-6">
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

        <aside className="lg:col-span-4 space-y-6 ">
          <AdBanner type="mpu" />

        </aside>
      </div>
    </div>
  );
};
