import React, { useState } from 'react';
import { CategoryType } from '../types/news';
import { SITE_CONFIG } from '../config/site';
import { Dialog } from './Dialog';
import { SpaLink, categoryHref } from './SpaLink';

interface FooterProps {
  onSelectCategory: (cat: CategoryType) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectCategory }) => {
  const [activeInfoModal, setActiveInfoModal] = useState<string | null>(null);
  const modalTitles: Record<string, string> = {
    about: `About ${SITE_CONFIG.name}`,
    contact: `Contact ${SITE_CONFIG.name}`,
    advertise: 'Commercial & Advertising',
    complaints: 'Editorial Complaints Policy',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Settings',
    terms: 'Terms and Conditions',
  };

  return (
    <footer className="bg-neutral-900 text-neutral-400 text-xs border-t-4 border-[#0B2545] pt-8 pb-10 mt-12 no-print">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        {/* Top Logo & Slogan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-headline font-black text-2xl text-white uppercase tracking-tight">
              {SITE_CONFIG.name}
            </span>
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

        {/* Corporate & Legal Navigation */}
        <div className="pt-3 border-t border-neutral-800 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-neutral-400">
          <button
            type="button"
            onClick={() => setActiveInfoModal('about')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            About Us
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('contact')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Contact Us
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('advertise')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Advertise with Us
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('complaints')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Editorial Complaints
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('privacy')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Privacy Notice
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('cookies')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Cookie Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal('terms')}
            className="py-1 hover:text-white hover:underline"
            aria-haspopup="dialog"
          >
            Terms & Conditions
          </button>
        </div>

        {/* Legal Disclaimer & Placeholders */}
        <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1 leading-relaxed">
          <p>
            {SITE_CONFIG.name} is an independent Scottish regional news publication. We abide by established professional journalistic standards and the Editor's Code of Practice.
          </p>
          <p>
            © {new Date().getFullYear()} {SITE_CONFIG.companyName}. Registered in Scotland ({SITE_CONFIG.companyNumber}). All rights reserved.
          </p>
        </div>
      </div>

      {/* Info dialogs */}
      <Dialog
        open={!!activeInfoModal}
        onClose={() => setActiveInfoModal(null)}
        title={activeInfoModal ? modalTitles[activeInfoModal] : ''}
        className="bg-white text-neutral-900 max-w-lg w-full p-5 border border-neutral-300 shadow-xl"
        renderHeader={(titleId) => (
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h2 id={titleId} className="font-headline font-bold text-base text-neutral-900 uppercase">
              {activeInfoModal ? modalTitles[activeInfoModal] : ''}
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
            <div className="text-xs text-neutral-700 space-y-2 leading-relaxed">
          {activeInfoModal === 'about' && (
            <p>
              {SITE_CONFIG.name} provides local news coverage across Glasgow, Clydeside, Lanarkshire, and Scotland, operated by {SITE_CONFIG.companyName}.
            </p>
          )}
          {activeInfoModal === 'contact' && (
            <div className="space-y-1.5">
              <p><strong>Editorial Newsdesk:</strong> {SITE_CONFIG.newsdeskEmail}</p>
              <p><strong>General Enquiries:</strong> {SITE_CONFIG.contactEmail}</p>
              <p><strong>Telephone:</strong> {SITE_CONFIG.phone}</p>
              <p><strong>Company Registration:</strong> {SITE_CONFIG.companyNumber}</p>
            </div>
          )}
          {activeInfoModal === 'advertise' && (
            <p>
              For commercial partnerships and advertising opportunities, please email {SITE_CONFIG.advertisingEmail}.
            </p>
          )}
          {activeInfoModal === 'complaints' && (
            <p>
              We aim for fairness and accuracy in our reporting. Formal editorial concerns may be directed to {SITE_CONFIG.complaintsEmail}.
            </p>
          )}
          {activeInfoModal === 'privacy' && (
            <p>We respect your privacy under the UK Data Protection Act 2018 and UK GDPR.</p>
          )}
          {activeInfoModal === 'cookies' && (
            <p>We use essential cookies to maintain site performance and reading preferences.</p>
          )}
          {activeInfoModal === 'terms' && (
            <p>Content published is protected under UK and international copyright law.</p>
          )}
        </div>

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
