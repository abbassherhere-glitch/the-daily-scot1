export interface SectionConfig {
  slug: string;
  label: string;
  path: string;
  description: string;
}

export const SITE_CONFIG = {
  name: 'The Daily Scot',
  tagline: "Glasgow & Scotland's Local News",
  siteUrl: 'thedailyscot.co.uk',
  companyName: 'The Daily Scot',
  // Leave any of these empty ('') until it really exists: the lines and sentences that show it are left out, and any
  // company page that depends on it (Contact, Advertise, Complaints, Privacy) stays out of Google until it is filled in.
  // Anything wrapped in [square brackets] is treated as an unfinished placeholder (see companyDetailsIncomplete).
  companyNumber: '',
  contactEmail: '',
  newsdeskEmail: '',
  phone: '',
  complaintsEmail: '',
  advertisingEmail: '',
  regulatoryNotice: 'Independent local journalism produced in accordance with established UK journalistic standards.',
  weatherLocation: {
    name: 'Glasgow',
    latitude: 55.8642,
    longitude: -4.2518,
  },
  // Exact specified navigation sections in order:
  // Home, News, Glasgow, Scotland, Politics, Business, Property, Sport, What's On, Opinion
  sections: [
    { slug: 'home', label: 'Home', path: '/', description: 'Latest top news and breaking stories' },
    { slug: 'news', label: 'News', path: '/news/news', description: 'Latest news, crime, courts and reports' },
    { slug: 'glasgow', label: 'Glasgow', path: '/news/glasgow', description: 'Local community stories and neighbourhood news across Glasgow' },
    { slug: 'scotland', label: 'Scotland', path: '/news/scotland', description: 'Scottish national news, transport and politics' },
    { slug: 'politics', label: 'Politics', path: '/news/politics', description: 'Glasgow City Chambers, Holyrood and Scottish council affairs' },
    { slug: 'business', label: 'Business', path: '/news/business', description: 'Local high street, commercial property, jobs and retail news' },
    { slug: 'property', label: 'Property', path: '/news/property', description: 'Glasgow house prices, tenement sales and new developments' },
    { slug: 'sport', label: 'Sport', path: '/news/sport', description: "Celtic, Rangers, Partick Thistle, Queen's Park and Scottish sport" },
    { slug: 'whats-on', label: "What's On", path: '/news/whats-on', description: 'Glasgow food, drink, restaurants, gigs, events and things to do' },
    { slug: 'opinion', label: 'Opinion', path: '/news/opinion', description: 'Comment, letters and analysis from The Daily Scot columnists' },
  ] as SectionConfig[],
};
