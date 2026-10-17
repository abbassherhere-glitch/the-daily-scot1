export type CategoryType =
  | 'all'
  | 'news'
  | 'glasgow'
  | 'scotland'
  | 'politics'
  | 'business'
  | 'property'
  | 'sport'
  | 'whats-on'
  | 'opinion';

export type ArticleStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'scheduled'
  | 'unpublished'
  | 'archived';

export interface Author {
  name: string;
  role: string;
  avatar: string;
  slug?: string; // byline URL slug for /author/<slug>; derived from the name when missing
  bio?: string;
  twitter?: string;
}

export interface Comment {
  id: string;
  author: string;
  location?: string;
  timeAgo: string;
  content: string;
  likes: number;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  category: CategoryType;
  subcategory?: string;
  locationTag?: string; // e.g. "West End", "Southside", "City Centre", "Holyrood"
  content: string[]; // multi-paragraph text
  pullQuote?: {
    text: string;
    attribution: string;
  };
  author: Author;
  publishedAt: string; // ISO or human readable
  updatedAt?: string;
  readTime: string;
  heroImage: string;
  heroCaption: string;
  heroCredit: string;
  isBreaking?: boolean;
  isFeaturedLead?: boolean;
  isTopStory?: boolean;
  views: number;
  comments: Comment[];
  tags: string[];
  isPartial?: boolean; // true when loaded from a list endpoint without the body
}

export interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  windSpeed: string;
  humidity: string;
  clydeTide: string;
  summary: string;
}

export interface TravelAlert {
  id: string;
  line: string;
  status: 'Good Service' | 'Minor Delays' | 'Planned Works' | 'Disruption';
  detail: string;
  badgeColor: string;
}
