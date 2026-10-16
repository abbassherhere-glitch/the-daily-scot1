import React from 'react';
import { Article, CategoryType } from '../types/news';

/** URL of an article page */
export function articleHref(article: Pick<Article, 'slug'>): string {
  return `/news/${encodeURIComponent(article.slug)}`;
}

/** URL of a section page ('all' / 'home' is the homepage) */
export function categoryHref(category: CategoryType | 'home' | string): string {
  return category === 'all' || category === 'home' ? '/' : `/news/${encodeURIComponent(category)}`;
}

/**
 * A real link (<a href>) that navigates inside the app without a page reload.
 *
 * - Keyboard and screen-reader users can reach and activate it like any link.
 * - Ctrl/Cmd/Shift-click, middle-click and "Open in new tab" still work, because those are left to
 *   the browser; only a plain left-click is intercepted.
 * - Search engines can follow it.
 */
export const SpaLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate: () => void }
>(({ href, onNavigate, onClick, children, ...rest }, ref) => (
  <a
    ref={ref}
    href={href}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onNavigate();
    }}
    {...rest}
  >
    {children}
  </a>
));
SpaLink.displayName = 'SpaLink';
