import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { CATEGORIES } from '../data/mockArticles';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';

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
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const categoryMeta = CATEGORIES.find((c) => c.id === category) || {
    id: category,
    label: category.toUpperCase(),
    description: `Latest news and updates in ${category}`,
  };

  const categoryArticles = useMemo(() => {
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    categoryArticles.forEach((a) => {
      if (a.subcategory) set.add(a.subcategory);
      if (a.locationTag) set.add(a.locationTag);
      a.tags.forEach((t) => set.add(t));
    });
    return Array.from(set).slice(0, 6);
  }, [categoryArticles]);

  const filteredArticles = useMemo(() => {
    if (selectedTag === 'all') return categoryArticles;
    return categoryArticles.filter(
      (a) =>
        a.subcategory?.toLowerCase() === selectedTag.toLowerCase() ||
        a.locationTag?.toLowerCase() === selectedTag.toLowerCase() ||
        a.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
    );
  }, [categoryArticles, selectedTag]);

  const leadStory = filteredArticles[0];
  const remainingStories = filteredArticles.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-6 bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs uppercase font-black tracking-wider text-[#005EB8] border-b border-neutral-200 pb-2">
        <button onClick={() => onSelectCategory('all')} className="hover:underline">
          Home
        </button>
        <ChevronRight className="w-3 h-3 text-neutral-400" />
        <span className="text-neutral-900">{categoryMeta.label}</span>
      </div>

      {/* Category Section Header (Flat brand bar) */}
      <div className="border-b-4 border-[#0B2545] pb-3">
        <h1 className="font-headline font-black text-3xl sm:text-4xl text-neutral-900 uppercase tracking-tight">
          {categoryMeta.label}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 font-serif mt-1">
          {categoryMeta.description}
        </p>

        {/* Tag Filters */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2 border-t border-neutral-100 text-xs">
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 font-bold uppercase transition ${
                selectedTag === 'all'
                  ? 'bg-[#0B2545] text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
              }`}
            >
              All {categoryMeta.label}
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1 font-semibold transition ${
                  selectedTag === tag
                    ? 'bg-[#0B2545] text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
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

          {/* Quick links block */}
          <div className="border border-neutral-200 p-4">
            <h4 className="font-headline font-black text-xs uppercase tracking-wider text-neutral-900 border-b-2 border-neutral-900 pb-1.5 mb-3">
              Section Topics
            </h4>
            <div className="space-y-1.5 text-xs">
              {availableTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className="block text-neutral-700 hover:text-[#005EB8] hover:underline"
                >
                  › {t}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
