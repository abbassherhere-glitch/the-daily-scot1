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
    cookies: 'Cookie Policy',
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
        <div className="text-xs text-neutral-700 space-y-2 leading-relaxed max-h-[65vh] overflow-y-auto pr-1">
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
            <div className="space-y-2">
              <p>
                This notice explains how {SITE_CONFIG.companyName} ("we", "us"), publisher of {SITE_CONFIG.name} at {SITE_CONFIG.siteUrl}, handles personal data under the UK GDPR and the Data Protection Act 2018. We are the data controller. Contact us about your data at {SITE_CONFIG.contactEmail}.
              </p>
              <h3 className="font-bold text-neutral-900">What we collect and why</h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Newsletter sign-ups:</strong> your email address, whether you have confirmed it, and the date you signed up. We use it only to send the newsletter you asked for. Lawful basis: your consent, which you can withdraw at any time with the unsubscribe link in every email.
                </li>
                <li>
                  <strong>Spam and abuse protection:</strong> when you submit the newsletter form, your IP address is checked by Cloudflare Turnstile and held for about 10 minutes to limit repeated sign-ups. Lawful basis: our legitimate interest in keeping the site secure.
                </li>
                <li>
                  <strong>Reading statistics:</strong> we count how many times each article is read per day to show "most read" lists. These counts are not linked to you, your device or your IP address.
                </li>
                <li>
                  <strong>Emails you send us:</strong> if you contact the newsdesk or make a complaint, we keep your message and contact details to respond and keep a record of it. Lawful basis: our legitimate interest in running the newsroom.
                </li>
              </ul>
              <h3 className="font-bold text-neutral-900">Who processes data for us</h3>
              <p>
                Cloudflare hosts the site and database and provides Turnstile. Resend sends newsletter emails. Google Fonts supplies our typefaces and Open-Meteo supplies the weather panel; your browser contacts them directly, so they receive your IP address. Some of these providers may process data outside the UK under recognised safeguards such as the UK International Data Transfer Addendum. We do not sell your data or use it for advertising.
              </p>
              <h3 className="font-bold text-neutral-900">How long we keep it</h3>
              <p>
                Newsletter details are deleted as soon as you unsubscribe. Rate-limit records are deleted automatically within minutes. Correspondence is kept only as long as needed to deal with it.
              </p>
              <h3 className="font-bold text-neutral-900">Your rights</h3>
              <p>
                You can ask to access, correct or delete your data, object to or restrict how we use it, or withdraw consent, by emailing {SITE_CONFIG.contactEmail}. If you are unhappy with our response you can complain to the Information Commissioner's Office at ico.org.uk.
              </p>
              <p className="text-neutral-500">Last updated: October 2026.</p>
            </div>
          )}
          {activeInfoModal === 'cookies' && (
            <div className="space-y-2">
              <p>
                {SITE_CONFIG.name} does not use advertising, tracking or analytics cookies, so we do not ask for cookie consent.
              </p>
              <p>
                Our hosting provider Cloudflare may place strictly necessary security cookies (such as <code>__cf_bm</code> or <code>cf_clearance</code>) when it checks for bots, including on the newsletter form. These are needed to keep the site secure, contain no advertising profile and expire within hours.
              </p>
              <p>
                You can block or delete cookies in your browser settings. The site will still work, though security checks may ask you to verify you are human more often.
              </p>
              <p>If we ever add cookies that are not strictly necessary, we will ask for your consent first and update this page.</p>
              <p className="text-neutral-500">Last updated: October 2026.</p>
            </div>
          )}
          {activeInfoModal === 'terms' && (
            <div className="space-y-2">
              <p>
                These terms apply to your use of {SITE_CONFIG.siteUrl}, published by {SITE_CONFIG.companyName}, registered in Scotland ({SITE_CONFIG.companyNumber}). By using the site you accept them.
              </p>
              <h3 className="font-bold text-neutral-900">Our content</h3>
              <p>
                All articles, photographs and graphics are owned by us or our licensors and are protected by copyright. You may read, print and share links to our articles for personal, non-commercial use. You may not copy, republish, sell or systematically scrape our content, or use it to train AI systems, without our written permission. For licensing, email {SITE_CONFIG.contactEmail}.
              </p>
              <h3 className="font-bold text-neutral-900">Accuracy</h3>
              <p>
                We work hard to be accurate, but news changes quickly and articles reflect what was known when published. Content is for general information, not professional advice. To report an error, see our Editorial Complaints policy.
              </p>
              <h3 className="font-bold text-neutral-900">Using the site</h3>
              <p>
                Do not misuse the site, for example by trying to gain unauthorised access, disrupt it, or send automated requests in bulk. Links to other websites are provided for convenience; we are not responsible for their content.
              </p>
              <h3 className="font-bold text-neutral-900">Liability</h3>
              <p>
                The site is provided free of charge and "as is". To the extent the law allows, we are not liable for any loss arising from use of the site. Nothing in these terms limits liability that cannot be limited by law.
              </p>
              <h3 className="font-bold text-neutral-900">Law</h3>
              <p>These terms are governed by Scots law, and the courts of Scotland have jurisdiction. We may update them from time to time.</p>
              <p className="text-neutral-500">Last updated: October 2026.</p>
            </div>
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
