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
    <footer className="bg-neutral-900 text-neutral-400 text-xs border-t-4 border-[#0B2545] pt-8 pb-10 mt-12 no-print">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        {/* Top Logo & Slogan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <Logo className="h-14 w-auto self-center rounded-[3px]" />
            <span className="sr-only">{SITE_CONFIG.name}</span>
            <span className="text-neutral-400 font-semibold" aria-hidden="true">|</span>
            <span className="text-neutral-400 font-medium">{SITE_CONFIG.tagline}</span>
          </div>

          <div className="text-[11px] text-neutral-400">
            {SITE_CONFIG.regulatoryNotice}
          </div>
        </div>

        {/* Section Links Row (from SITE_CONFIG) */}
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-2">
            Sections
          </h2>
          <nav aria-label="Footer sections">
            <ul className="flex flex-wrap gap-x-2 gap-y-1 text-neutral-300 font-medium">
              {SITE_CONFIG.sections.map((sec) => (
                <li key={sec.slug}>
                  <SpaLink
                    href={categoryHref(sec.slug)}
                    onNavigate={() => onSelectCategory(sec.slug === 'home' ? 'all' : (sec.slug as CategoryType))}
                    className="inline-block py-1 px-1 hover:text-white hover:underline transition"
                  >
                    {sec.label}
                  </SpaLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Corporate & Legal Navigation: real links to each page; a plain click opens the pop-up instead */}
        <nav aria-label="Company and legal" className="pt-3 border-t border-neutral-800 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-neutral-400">
          {INFO_PAGES.map((page) => (
            <SpaLink
              key={page.id}
              href={page.path}
              onNavigate={() => setActiveInfoModal(page.id)}
              className="py-1 hover:text-white hover:underline"
              aria-haspopup="dialog"
            >
              {page.linkLabel}
            </SpaLink>
          ))}
        </nav>

        {/* Legal Disclaimer & Placeholders */}
        <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1 leading-relaxed">
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
        className="bg-white text-neutral-900 max-w-lg w-full p-5 border border-neutral-300 shadow-xl"
        renderHeader={(titleId) => (
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h2 id={titleId} className="font-headline font-bold text-base text-neutral-900 uppercase">
              {modalTitle}
            </h2>
            <button
              type="button"
              onClick={() => setActiveInfoModal(null)}
              className="text-neutral-600 hover:text-neutral-900 font-bold p-1.5 text-sm"
              aria-label="Close"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
      >
        <InfoContent
          id={activeInfoModal as InfoPageId}
          className="text-xs text-neutral-700 space-y-2 leading-relaxed max-h-[65vh] overflow-y-auto pr-1"
        />

        <div className="mt-4 pt-2 border-t flex justify-end">
          <button
            type="button"
            onClick={() => setActiveInfoModal(null)}
            className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </Dialog>
    </footer>
  );
};
