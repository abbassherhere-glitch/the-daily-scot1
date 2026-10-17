import React from 'react';
import { Article, CategoryType } from '../types/news';

/** URL of an article page */
export function articleHref(article: Pick<Article, 'slug'>): string {
  return `/news/${encodeURIComponent(article.slug)}`;
}

/** The newsdesk byline used when a story has no individual credit */
export const STAFF_BYLINE = 'The Daily Scot Staff';

/** URL-friendly form of a byline name, e.g. "Syed Hassan" -> "syed-hassan" (matches the server). */
export function bylineSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

/** URL of an author page, optionally a later page of their stories */
export function authorHref(author: { slug?: string; name: string }, page = 1): string {
  const slug = author.slug || bylineSlug(author.name) || 'the-daily-scot-staff';
  return `/author/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ''}`;
}

/**
 * Navigate inside the app to any path without a reload. The app's router listens for popstate,
 * so this works from any component without passing navigation callbacks down.
 */
export function navigateTo(href: string): void {
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
