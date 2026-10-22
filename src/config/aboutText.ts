/**
 * The text of the About page. Shared by the React app (src/components/InfoContent.tsx) and the
 * Pages Function that serves /about (functions/[[path]].ts), so search engines read the full page
 * from the server, not just a one-line summary.
 *
 * Plain text only (no HTML). Each section has an optional id so other pages and the structured data
 * can link straight to it (e.g. /about#corrections).
 */

export interface AboutSection {
  id?: string;
  heading?: string;
  paragraphs: string[];
}

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    paragraphs: [
      'The Daily Scot is an independent news website based in Glasgow, covering the city and the rest of Scotland. We launched in October 2026 to give Glasgow a fast, free and clear local news service.',
      'We are not part of any newspaper group, and our news is free to read.',
    ],
  },
  {
    id: 'coverage',
    heading: 'What we cover',
    paragraphs: [
      "Council decisions and planning applications, courts and crime, transport and roadworks, property and housing, business and the high street, Celtic, Rangers and Scottish sport, and food, drink and what's on in Glasgow.",
    ],
  },
  {
    id: 'how-we-report',
    heading: 'How we report',
    paragraphs: [
      'We go to primary sources wherever we can: Glasgow City Council and other local authorities, Police Scotland, the courts, Transport Scotland, rail and bus operators, and official announcements and press releases.',
      'When we follow up a story first reported elsewhere, we aim to add new information or context, and we credit the original outlet.',
    ],
  },
  {
    id: 'ai',
    heading: 'How we use AI',
    paragraphs: [
      'We use AI tools to help research and draft some of our stories. Our editors are responsible for everything we publish, and we correct mistakes whatever their source.',
    ],
  },
  {
    id: 'photographs',
    heading: 'Photographs',
    paragraphs: [
      "Where we don't have our own picture, we use file photographs, usually from Wikimedia Commons under Creative Commons licences, and credit the photographer in the caption.",
    ],
  },
  {
    id: 'corrections',
    heading: 'Corrections',
    paragraphs: [
      'If we get something wrong, we correct it promptly and note the correction in the article. To report an error, see our Editorial Complaints policy.',
    ],
  },
];
