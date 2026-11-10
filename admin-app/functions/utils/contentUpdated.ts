/**
 * Records that a story's words (headline, standfirst or body) have just changed, in articles.content_updated_at.
 * The public site shows this as the story's "Updated" time and uses it for "Happening now".
 *
 * The column arrives with migration 0004. It is written separately from the main save and never throws, so
 * saving a story works the same whether or not the migration has been run yet.
 */
export async function markContentUpdated(
  db: { prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } },
  articleId: string,
): Promise<void> {
  try {
    await db.prepare("UPDATE articles SET content_updated_at = datetime('now') WHERE id = ?").bind(articleId).run();
  } catch (err) {
    console.warn('Could not record the content update time (has migration 0004 been run?):', err);
  }
}
