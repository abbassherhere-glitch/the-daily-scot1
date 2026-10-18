import React from 'react';
import { SITE_CONFIG } from '../config/site';
import type { InfoPageId } from '../config/infoPages';

/**
 * The text of the About / Contact / Advertise / Complaints / Privacy / Cookie / Terms pages.
 * Shown in the footer's pop-ups and, at its own address (/about, /privacy...), as a page.
 */
export const InfoContent: React.FC<{ id: InfoPageId; className?: string }> = ({ id, className }) => (
  <div className={className}>
    {id === 'about' && (
      <p>
        {SITE_CONFIG.name} provides local news coverage across Glasgow, Clydeside, Lanarkshire, and Scotland, operated by {SITE_CONFIG.companyName}.
      </p>
    )}
    {id === 'contact' && (
      <div className="space-y-1.5">
        <p><strong>Editorial Newsdesk:</strong> {SITE_CONFIG.newsdeskEmail}</p>
        <p><strong>General Enquiries:</strong> {SITE_CONFIG.contactEmail}</p>
        {SITE_CONFIG.phone && <p><strong>Telephone:</strong> {SITE_CONFIG.phone}</p>}
        {SITE_CONFIG.companyNumber && <p><strong>Company Registration:</strong> {SITE_CONFIG.companyNumber}</p>}
      </div>
    )}
    {id === 'advertise' && (
      <p>
        For commercial partnerships and advertising opportunities, please email {SITE_CONFIG.advertisingEmail}.
      </p>
    )}
    {id === 'complaints' && (
      <p>
        We aim for fairness and accuracy in our reporting. Formal editorial concerns may be directed to {SITE_CONFIG.complaintsEmail}.
      </p>
    )}
    {id === 'privacy' && (
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
            <strong>Reading statistics:</strong> we count how many times each article is read per day to show "most read" lists. These counts are not linked to you, your device or your IP address. We also use Cloudflare Web Analytics to count visits to the site; it does not use cookies or track you across other websites.
          </li>
          <li>
            <strong>Emails you send us:</strong> if you contact the newsdesk or make a complaint, we keep your message and contact details to respond and keep a record of it. Lawful basis: our legitimate interest in running the newsroom.
          </li>
        </ul>
        <h3 className="font-bold text-neutral-900">Who processes data for us</h3>
        <p>
          Cloudflare hosts the site and database and provides Turnstile and Web Analytics. Resend sends newsletter emails. Google Fonts supplies our typefaces and Open-Meteo supplies the weather panel; your browser contacts them directly, so they receive your IP address. Some of these providers may process data outside the UK under recognised safeguards such as the UK International Data Transfer Addendum. We do not sell your data or use it for advertising.
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
    {id === 'cookies' && (
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
    {id === 'terms' && (
      <div className="space-y-2">
        <p>
          These terms apply to your use of {SITE_CONFIG.siteUrl}, published by {SITE_CONFIG.companyName}{SITE_CONFIG.companyNumber ? `, registered in Scotland (${SITE_CONFIG.companyNumber})` : ''}. By using the site you accept them.
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
);
