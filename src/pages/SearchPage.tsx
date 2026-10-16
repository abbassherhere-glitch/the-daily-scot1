import React, { useState, useMemo } from 'react';
import { Search as SearchIcon, X, ChevronRight } from 'lucide-react';
import { Article, CategoryType } from '../types/news';
import { CATEGORIES } from '../data/mockArticles';
import { ArticleCard } from '../components/ArticleCard';
import { AdBanner } from '../components/AdBanner';

interface SearchPageProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
  onSelectCategory: (cat: CategoryType) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  articles,
  onSelectArticle,
  onSelectCategory,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'all'>('all');

  const SUGGESTED_QUERIES = [
    'M8',
    'Licence',
    'Celtic',
    'Rangers',
    'Shawlands',
    'Partick Thistle',
    'Finnieston',
    'Property',
  ];

  const results = useMemo(() => {
    let list = articles;

    if (selectedCategory !== 'all') {
      list = list.filter((a) => a.category === selectedCategory);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const inTitle = a.title.toLowerCase().includes(q);
        const inStandfirst = a.standfirst.toLowerCase().includes(q);
        const inCategory = a.category.toLowerCase().includes(q);
        const inLocation = a.locationTag?.toLowerCase().includes(q);
        const inTags = a.tags.some((t) => t.toLowerCase().includes(q));
        const inContent = a.content.some((c) => c.toLowerCase().includes(q));

        return inTitle || inStandfirst || inCategory || inLocation || inTags || inContent;
      });
    }

    return list;
  }, [articles, query, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-5 bg-white">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs uppercase font-black tracking-wider text-[#005EB8] border-b border-neutral-200 pb-2">
        <button onClick={() => onSelectCategory('all')} className="hover:underline">
          Home
        </button>
        <ChevronRight className="w-3 h-3 text-neutral-400" />
        <span className="text-neutral-900">Search</span>
      </div>

      {/* Flat Search Header */}
      <div className="border-b-4 border-[#0B2545] pb-4">
        <h1 className="font-headline font-black text-2xl sm:text-3xl text-neutral-900 uppercase tracking-tight">
          Search Articles
        </h1>

        <div className="mt-3 flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Glasgow news, sport, traffic, property..."
              className="w-full border border-neutral-300 p-2.5 text-sm font-sans focus:outline-hidden focus:border-[#005EB8]"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-3 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Suggested keywords */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-bold text-neutral-500 uppercase text-[10px]">Popular:</span>
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              onClick={() => setQuery(sq)}
              className="px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs border border-neutral-200"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Category selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 border-b border-neutral-200">
        <span className="font-bold text-neutral-600 uppercase tracking-wider text-[11px] mr-1">Section:</span>
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 font-bold uppercase transition ${
            selectedCategory === 'all'
              ? 'bg-[#005EB8] text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-2.5 py-1 font-semibold transition ${
              selectedCategory === c.id
                ? 'bg-[#005EB8] text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Results Header */}
      <div className="text-xs font-semibold text-neutral-600">
        Found {results.length} {results.length === 1 ? 'article' : 'articles'}
        {query ? ` for "${query}"` : ''}
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div className="p-8 border border-neutral-200 text-center font-serif text-neutral-600">
          No articles found. Try another search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((art) => (
            <ArticleCard
              key={art.id}
              article={art}
              variant="grid-card"
              onSelect={onSelectArticle}
            />
          ))}
        </div>
      )}

      <AdBanner type="leaderboard" className="mt-6" />
    </div>
  );
};
