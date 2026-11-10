/**
 * Reader aids read out of a story's body, shared by the React app (src/) and the Pages Functions (functions/).
 *
 * - Key facts: a heading such as "Key facts" followed directly by a bullet list is shown as a summary box.
 * - Questions: a heading that ends in "?" followed by a paragraph is treated as a question and its answer.
 *   Any heading that ends in "?" is also marked so both versions of the page can underline it in yellow.
 */

const KEY_FACTS_HEADINGS = /^(key facts|key points|at a glance|what we know( so far)?|what you need to know)$/i;

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface KeyFacts {
  heading: string;
  facts: string[];
  /** The story body with the key facts block taken out */
  body: string;
}

/** Finds the key facts block (heading + bullet list) in a story body, if it has one. */
export function splitKeyFacts(body: string): KeyFacts | null {
  if (!body) return null;
  const blockRegex = /<h2[^>]*>((?:(?!<\/h2>)[\s\S])*)<\/h2>\s*<ul[^>]*>((?:(?!<\/ul>)[\s\S])*)<\/ul>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(body)) !== null) {
    const heading = plainText(match[1]);
    if (!KEY_FACTS_HEADINGS.test(heading)) continue;
    const facts = (match[2].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []).map(plainText).filter(Boolean);
    if (facts.length === 0) return null;
    return {
      heading,
      facts,
      body: (body.slice(0, match.index) + body.slice(match.index + match[0].length)).trim(),
    };
  }
  return null;
}

export interface StoryQuestion {
  question: string;
  answer: string;
}

/** Question headings and the paragraph that answers each one (at most six). */
export function storyQuestions(body: string): StoryQuestion[] {
  if (!body) return [];
  const out: StoryQuestion[] = [];
  const regex = /<h([23])[^>]*>((?:(?!<\/h[23]>)[\s\S])*)<\/h\1>\s*<p[^>]*>((?:(?!<\/p>)[\s\S])*)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null && out.length < 6) {
    const question = plainText(match[2]);
    const answer = plainText(match[3]);
    if (question.endsWith('?') && answer) out.push({ question, answer });
  }
  return out;
}

/** Class put on question subheadings (styled in src/index.css for the app and in functions/utils/seo.ts for the server page). */
export const QUESTION_HEADING_CLASS = 'ds-question';

/** Marks every h2/h3 whose text ends in "?" with QUESTION_HEADING_CLASS. Run it on HTML that is already sanitised. */
export function markQuestionHeadings(html: string): string {
  if (!html || html.indexOf('?') === -1) return html;
  return html.replace(/<h([23])(\s[^>]*)?>((?:(?!<\/h\1>)[\s\S])*)<\/h\1>/gi, (whole, level: string, _attrs: string, inner: string) =>
    plainText(inner).endsWith('?') ? `<h${level} class="${QUESTION_HEADING_CLASS}">${inner}</h${level}>` : whole,
  );
}
