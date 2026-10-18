import { SITE_CONFIG } from './site';

export type InfoPageId = 'about' | 'contact' | 'advertise' | 'complaints' | 'privacy' | 'cookies' | 'terms';

export interface InfoPageConfig {
  id: InfoPageId;
  path: string;
  /** Page heading, <title> and the footer pop-up's heading */
  title: string;
  /** Footer link text */
  linkLabel: string;
  /** Meta description */
  description: string;
}

/**
 * The company / legal pages. Each opens as a pop-up from the footer and also exists at its own
 * address, so search engines (and anyone who opens a footer link in a new tab) get a real page.
 */
export const INFO_PAGES: InfoPageConfig[] = [
  {
    id: 'about',
    path: '/about',
    title: `About ${SITE_CONFIG.name}`,
    linkLabel: 'About Us',
    description: `About ${SITE_CONFIG.name}: independent local news coverage across Glasgow, Clydeside, Lanarkshire and Scotland.`,
  },
  {
    id: 'contact',
    path: '/contact',
    title: `Contact ${SITE_CONFIG.name}`,
    linkLabel: 'Contact Us',
    description: `How to contact the ${SITE_CONFIG.name} newsdesk, and who to write to about general enquiries.`,
  },
  {
    id: 'advertise',
    path: '/advertise',
    title: 'Commercial & Advertising',
    linkLabel: 'Advertise with Us',
    description: `Commercial partnerships and advertising with ${SITE_CONFIG.name}, Glasgow and Scotland's local news site.`,
  },
  {
    id: 'complaints',
    path: '/complaints',
    title: 'Editorial Complaints Policy',
    linkLabel: 'Editorial Complaints',
    description: `How to raise a concern about the accuracy or fairness of a ${SITE_CONFIG.name} story.`,
  },
  {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    linkLabel: 'Privacy Notice',
    description: `How ${SITE_CONFIG.name} collects and uses personal data, and your rights under UK data protection law.`,
  },
  {
    id: 'cookies',
    path: '/cookies',
    title: 'Cookie Policy',
    linkLabel: 'Cookie Policy',
    description: `The cookies ${SITE_CONFIG.name} uses (strictly necessary security cookies only) and how to control them.`,
  },
  {
    id: 'terms',
    path: '/terms',
    title: 'Terms and Conditions',
    linkLabel: 'Terms & Conditions',
    description: `The terms for using ${SITE_CONFIG.siteUrl}: copyright, accuracy, acceptable use and liability.`,
  },
];

export function infoPageByPath(path: string): InfoPageConfig | undefined {
  const clean = path.replace(/\/+$/, '') || '/';
  return INFO_PAGES.find((p) => p.path === clean);
}

/**
 * True while any company detail in SITE_CONFIG is still a "[Company name]"-style placeholder.
 * Until they are filled in, the info pages are kept out of Google (and the sitemap) so that
 * search results never show placeholder text; they switch on by themselves once the details are real.
 */
export function companyDetailsIncomplete(): boolean {
  return [
    SITE_CONFIG.companyName,
    SITE_CONFIG.companyNumber,
    SITE_CONFIG.contactEmail,
    SITE_CONFIG.newsdeskEmail,
    SITE_CONFIG.complaintsEmail,
    SITE_CONFIG.advertisingEmail,
    SITE_CONFIG.phone,
  ].some((value) => /^\[.*\]$/.test(String(value ?? '').trim()));
}
