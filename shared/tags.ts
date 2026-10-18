export function normaliseTags(raw: unknown, maxTags = 20, maxLength = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const clean = name
      .replace(/[[\]"\\]/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
      .trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); out.push(clean); }
  };
  const visit = (value: unknown, depth: number) => {
    if (value == null || depth > 6) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const text = String(value).trim();
    if (!text) return;
    if (text.startsWith('[')) {
      try { visit(JSON.parse(text), depth + 1); return; } catch { /* fragment: strip below */ }
    }
    text.split(',').forEach(add);
  };
  visit(raw, 0);
  return out.slice(0, maxTags);
}

/** Stored (database) form: a JSON array string. */
export function serialiseTags(raw: unknown): string {
  return JSON.stringify(normaliseTags(raw));
}
