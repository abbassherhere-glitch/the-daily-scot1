import { Article, Comment } from '../types/news';
import { INITIAL_ARTICLES } from '../data/mockArticles';

const STORAGE_KEY = 'daily_scot_articles_v1';
const BOOKMARKS_KEY = 'daily_scot_bookmarks_v1';
const NEWSLETTER_KEY = 'daily_scot_subscribers_v1';

export function getStoredArticles(): Article[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ARTICLES));
      return INITIAL_ARTICLES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ARTICLES));
      return INITIAL_ARTICLES;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load articles from storage', e);
    return INITIAL_ARTICLES;
  }
}

export function saveArticles(articles: Article[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
  } catch (e) {
    console.error('Failed to save articles to storage', e);
  }
}

export function getArticleByIdOrSlug(idOrSlug: string, articles?: Article[]): Article | undefined {
  const list = articles || getStoredArticles();
  return list.find((a) => a.id === idOrSlug || a.slug === idOrSlug);
}

export function saveArticle(article: Article): Article[] {
  const current = getStoredArticles();
  const existingIdx = current.findIndex((a) => a.id === article.id);
  
  let updated: Article[];
  if (existingIdx >= 0) {
    // If set as featured lead, unset others
    if (article.isFeaturedLead) {
      current.forEach((a) => {
        if (a.id !== article.id) a.isFeaturedLead = false;
      });
    }
    current[existingIdx] = {
      ...article,
      updatedAt: new Date().toISOString(),
    };
    updated = [...current];
  } else {
    // New article
    if (article.isFeaturedLead) {
      current.forEach((a) => {
        a.isFeaturedLead = false;
      });
    }
    updated = [article, ...current];
  }

  saveArticles(updated);
  return updated;
}

export function deleteArticle(articleId: string): Article[] {
  const current = getStoredArticles();
  const filtered = current.filter((a) => a.id !== articleId);
  saveArticles(filtered);
  return filtered;
}

export function resetToDefaultArticles(): Article[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ARTICLES));
  return INITIAL_ARTICLES;
}

export function addCommentToArticle(articleId: string, comment: Omit<Comment, 'id' | 'timeAgo' | 'likes'>): Article | undefined {
  const articles = getStoredArticles();
  const target = articles.find((a) => a.id === articleId);
  if (!target) return undefined;

  const newComment: Comment = {
    id: `c-${Date.now()}`,
    author: comment.author,
    location: comment.location || 'Glasgow',
    timeAgo: 'Just now',
    content: comment.content,
    likes: 0,
  };

  target.comments = [newComment, ...(target.comments || [])];
  saveArticles(articles);
  return target;
}

export function incrementArticleViews(articleId: string): void {
  const articles = getStoredArticles();
  const target = articles.find((a) => a.id === articleId);
  if (target) {
    target.views = (target.views || 0) + 1;
    saveArticles(articles);
  }
}

// Bookmarks / Saved Stories
export function getSavedArticleIds(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleSavedArticle(articleId: string): boolean {
  try {
    const ids = getSavedArticleIds();
    const isSaved = ids.includes(articleId);
    let next: string[];
    if (isSaved) {
      next = ids.filter((id) => id !== articleId);
    } else {
      next = [articleId, ...ids];
    }
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    return !isSaved;
  } catch {
    return false;
  }
}

// Newsletter
export function subscribeNewsletter(email: string): boolean {
  try {
    const raw = localStorage.getItem(NEWSLETTER_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(email)) {
      list.push(email);
      localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(list));
    }
    return true;
  } catch {
    return true;
  }
}
