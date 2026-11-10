import { Logo } from './Logo';
import React, { useState } from 'react';
import { CategoryType } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { INFO_PAGES, InfoPageId } from '../config/infoPages';
import { Dialog } from './Dialog';
import { InfoContent } from './InfoContent';
import { SpaLink, categoryHref } from './SpaLink';

interface FooterProps {
  onSelectCategory: (cat: CategoryType) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectCategory }) => {
  const [activeInfoModal, setActiveInfoModal] = useState<InfoPageId | null>(null);
  const modalTitle = INFO_PAGES.find((p) => p.id === activeInfoModal)?.title || '';

  return (
    <footer className="on-dark bg-brand-ink text-neutral-300 text-sm border-t-8 border-brand pt-8 pb-10 mt-12 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Logo and slogan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/25 pb-6 gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Logo variant="horizontal" className="h-11 w-auto" />
            <span className="sr-only">{SITE_CONFIG.name}</span>
            <span className="text-white font-bold">{SITE_CONFIG.tagline}</span>
          </div>

          <p className="text-xs text-neutral-300 sm:max-w-xs sm:text-right">{SITE_CONFIG.regulatoryNotice}</p>
        </div>

        {/* Section links (from SITE_CONFIG) */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand mb-1">Sections</h2>
          <nav aria-label="Footer sections">
            <ul className="flex flex-wrap gap-x-5 -ml-1 text-white font-bold">
              {SITE_CONFIG.sections.map((sec) => (
                <li key={sec.slug}>
                  <SpaLink
                    href={categoryHref(sec.slug)}
                    onNavigate={() => onSelectCategory(sec.slug === 'home' ? 'all' : (sec.slug as CategoryType))}
                    className="inline-flex items-center min-h-11 px-1 hover:underline underline-offset-4"
                  >
                    {sec.label}
                  </SpaLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Company and legal: real links to each page; a plain click opens the pop-up instead */}
        <nav aria-label="Company and legal" className="pt-3 border-t border-white/25 flex flex-wrap gap-x-5 -ml-1 text-[13px] text-neutral-200">
          {INFO_PAGES.map((page) => (
            <SpaLink
              key={page.id}
              href={page.path}
              onNavigate={() => setActiveInfoModal(page.id)}
              className="inline-flex items-center min-h-11 px-1 hover:text-white hover:underline underline-offset-4"
              aria-haspopup="dialog"
            >
              {page.linkLabel}
            </SpaLink>
          ))}
        </nav>

        {/* Legal lines */}
        <div className="pt-4 border-t border-white/25 text-xs text-neutral-300 space-y-1 leading-relaxed">
          <p>
            {SITE_CONFIG.name} is an independent Scottish regional news publication. We abide by established professional journalistic standards and the Editor's Code of Practice.
          </p>
          <p>
            © {new Date().getFullYear()} {SITE_CONFIG.companyName}.{SITE_CONFIG.companyNumber ? ` Registered in Scotland (${SITE_CONFIG.companyNumber}).` : ''} All rights reserved.
          </p>
        </div>
      </div>

      {/* Info dialogs */}
      <Dialog
        open={!!activeInfoModal}
        onClose={() => setActiveInfoModal(null)}
        title={modalTitle}
        className="bg-white text-neutral-900 max-w-lg w-full p-5 border-2 border-ink [&_:focus-visible]:outline-ink"
        renderHeader={(titleId) => (
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h2 id={titleId} className="font-headline font-bold text-base text-neutral-900 uppercase">
              {modalTitle}
            </h2>
            <button
              type="button"
              onClick={() => setActiveInfoModal(null)}
              className="inline-flex items-center justify-center w-11 h-11 -mr-2 text-neutral-900 font-bold text-base hover:bg-neutral-100"
              aria-label="Close"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
      >
        <InfoContent
          id={activeInfoModal as InfoPageId}
          className="text-sm text-neutral-800 space-y-2 leading-relaxed max-h-[65vh] overflow-y-auto pr-1"
        />

        <div className="mt-4 pt-2 border-t flex justify-end">
          <button
            type="button"
            onClick={() => setActiveInfoModal(null)}
            className="inline-flex items-center h-11 px-5 bg-brand-ink text-white text-sm font-extrabold hover:bg-brand hover:text-brand-ink"
          >
            Close
          </button>
        </div>
      </Dialog>
    </footer>
  );
};
