import React from 'react';
import { X, Bookmark, Trash2, ArrowRight, BookOpen } from 'lucide-react';
import { Article } from '../types/news';

interface SavedArticlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedArticles: Article[];
  onSelectArticle: (article: Article) => void;
  onRemoveSaved: (id: string) => void;
}

export const SavedArticlesModal: React.FC<SavedArticlesModalProps> = ({
  isOpen,
  onClose,
  savedArticles,
  onSelectArticle,
  onRemoveSaved,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60">
      <div 
        className="w-full max-w-md h-full bg-white border-l border-neutral-300 flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-3.5 bg-[#0B2545] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-white" />
            <div>
              <h3 className="font-headline font-bold text-sm uppercase tracking-wide">Saved Reading List</h3>
              <p className="text-[11px] text-neutral-300">
                {savedArticles.length} {savedArticles.length === 1 ? 'story' : 'stories'} saved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {savedArticles.length === 0 ? (
            <div className="text-center py-16 px-4">
              <BookOpen className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
              <h4 className="font-headline font-bold text-base text-neutral-900">
                No Saved Stories
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Click the bookmark icon on any story to save it for later.
              </p>
            </div>
          ) : (
            savedArticles.map((article) => (
              <div
                key={article.id}
                className="bg-white border border-neutral-200 p-2.5 flex flex-col justify-between hover:border-neutral-400 transition"
              >
                <div className="flex gap-2.5">
                  <div className="w-20 aspect-16/10 shrink-0 bg-neutral-100 overflow-hidden">
                    <img
                      src={article.heroImage}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-[#005EB8] block">
                      {article.subcategory || article.category}
                    </span>
                    <h5
                      onClick={() => {
                        onSelectArticle(article);
                        onClose();
                      }}
                      className="font-headline font-bold text-xs text-neutral-900 leading-snug line-clamp-2 hover:underline cursor-pointer mt-0.5"
                    >
                      {article.title}
                    </h5>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-400">
                    {article.readTime}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRemoveSaved(article.id)}
                      className="text-neutral-400 hover:text-red-600 p-0.5"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        onSelectArticle(article);
                        onClose();
                      }}
                      className="text-[#005EB8] font-bold text-xs flex items-center gap-1 hover:underline"
                    >
                      <span>Read</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-neutral-100 border-t border-neutral-200 text-center text-[11px] text-neutral-500">
          Saved locally on your device
        </div>
      </div>
    </div>
  );
};
