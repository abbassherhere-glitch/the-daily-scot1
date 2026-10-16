export interface Env {
  DB: {
    prepare(query: string): {
      bind(...values: any[]): any;
      all<T = unknown>(): Promise<{ results: T[] }>;
      run(): Promise<any>;
    };
  };
}

interface ScheduledArticle {
  id: string;
  title: string;
  published_at: string;
}

export default {
  // Cron trigger scheduled event handler (runs every 5 minutes)
  async scheduled(event: any, env: Env, ctx: any): Promise<void> {
    ctx.waitUntil(publishDueArticles(env));
  },

  // HTTP handler for manual trigger or healthcheck
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/trigger' || url.pathname === '/run') {
      const count = await publishDueArticles(env);
      return new Response(JSON.stringify({ success: true, published_count: count }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        service: 'The Daily Scot Automated Publishing Scheduler',
        interval: 'every 5 minutes (*/5 * * * *)',
        status: 'active',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
};

async function publishDueArticles(env: Env): Promise<number> {
  try {
    // 1. Find all scheduled stories whose embargo/published_at is due
    const { results } = await env.DB.prepare(`
      SELECT id, title, published_at 
      FROM articles 
      WHERE status = 'scheduled' 
        AND published_at IS NOT NULL 
        AND published_at <= datetime('now')
    `).all<ScheduledArticle>();

    if (!results || results.length === 0) {
      return 0;
    }

    let publishedCount = 0;

    for (const article of results) {
      // 2. Transition status from 'scheduled' to 'published'
      await env.DB.prepare(`
        UPDATE articles 
        SET status = 'published', updated_at = datetime('now') 
        WHERE id = ? AND status = 'scheduled'
      `)
        .bind(article.id)
        .run();

      // 3. Write audit log entry
      const auditId = `aud-sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await env.DB.prepare(`
        INSERT INTO audit_log (
          id, user_id, user_email, action, article_id, before_status, after_status, ip, details, created_at
        ) VALUES (?, 'system-scheduler', 'scheduler@worker.dailyscot.co.uk', 'SCHEDULED_PUBLISH', ?, 'scheduled', 'published', '127.0.0.1', ?, datetime('now'))
      `)
        .bind(
          auditId,
          article.id,
          `Automated cron publish of "${article.title}" (scheduled for ${article.published_at})`
        )
        .run();

      publishedCount++;
    }

    // 4. Clear is_breaking on expired items (breaking_until <= now)
    await env.DB.prepare(`
      UPDATE articles 
      SET is_breaking = 0, updated_at = datetime('now') 
      WHERE is_breaking = 1 
        AND breaking_until IS NOT NULL 
        AND breaking_until <= datetime('now')
    `).run();

    return publishedCount;
  } catch (err) {
    console.error('Error in publishDueArticles scheduler:', err);
    return 0;
  }
}
