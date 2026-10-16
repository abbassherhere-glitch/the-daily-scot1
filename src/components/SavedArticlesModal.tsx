import React from 'react';
import { X, Bookmark, Trash2, ArrowRight, BookOpen } from 'lucide-react';
import { Article } from '../types/news';
import { Dialog } from './Dialog';
import { SpaLink, articleHref } from './SpaLink';

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
  const open = (article: Article) => {
    onSelectArticle(article);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Saved reading list"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-end bg-black/60"
      className="w-full max-w-md h-full bg-white border-l border-neutral-300 flex flex-col font-sans"
      renderHeader={(titleId) => (
        <div className="p-3.5 bg-[#0B2545] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-white" aria-hidden="true" />
            <div>
              <h2 id={titleId} className="font-headline font-bold text-sm uppercase tracking-wide">
                Saved Reading List
              </h2>
              <p className="text-[11px] text-neutral-300">
                {savedArticles.length} {savedArticles.length === 1 ? 'story' : 'stories'} saved
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-200 hover:text-white"
            aria-label="Close saved reading list"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      )}
    >
      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3">
        {savedArticles.length === 0 ? (
          <div className="text-center py-16 px-4">
            <BookOpen className="w-10 h-10 text-neutral-500 mx-auto mb-2" aria-hidden="true" />
            <h3 className="font-headline font-bold text-base text-neutral-900">No Saved Stories</h3>
            <p className="text-xs text-neutral-600 mt-1">
              Use the Save button on any story to keep it for later.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {savedArticles.map((article) => (
              <li
                key={article.id}
                className="bg-white border border-neutral-200 p-2.5 flex flex-col justify-between hover:border-neutral-400 transition"
              >
                <div className="flex gap-2.5">
                  <div className="w-20 aspect-16/10 shrink-0 bg-neutral-100 overflow-hidden">
                    <img src={article.heroImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-[#005EB8] block">
                      {article.subcategory || article.category}
                    </span>
                    <h3 className="font-headline font-bold text-xs text-neutral-900 leading-snug line-clamp-2 mt-0.5">
                      <SpaLink
                        href={articleHref(article)}
                        onNavigate={() => open(article)}
                        className="hover:underline"
                      >
                        {article.title}
                      </SpaLink>
                    </h3>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-600">{article.readTime}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRemoveSaved(article.id)}
                      className="text-neutral-600 hover:text-red-700 p-1 min-w-6 min-h-6 flex items-center justify-center"
                      aria-label={`Remove "${article.title}" from saved list`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <SpaLink
                      href={articleHref(article)}
                      onNavigate={() => open(article)}
                      className="text-[#005EB8] font-bold text-xs flex items-center gap-1 hover:underline min-h-6"
                      aria-label={`Read "${article.title}"`}
                    >
                      <span>Read</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </SpaLink>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-2.5 bg-neutral-100 border-t border-neutral-200 text-center text-[11px] text-neutral-600">
        Saved locally on your device
      </div>
    </Dialog>
  );
};
