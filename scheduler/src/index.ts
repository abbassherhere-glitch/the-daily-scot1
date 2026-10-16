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
  legal_check: string | null;
  legal_checked: number;
  embargo_until: string | null;
  verified: number;
  source_type: string | null;
}

export default {
  // Cron trigger scheduled event handler (runs every 5 minutes)
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runScheduler(env));
  },

  // Health check only. Publishing is never triggered over public HTTP.
  async fetch(): Promise<Response> {
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

function blockReason(a: ScheduledArticle): string | null {
  if (a.legal_check && a.legal_check !== 'none' && !a.legal_checked) {
    return `legal flag "${a.legal_check}" has not been cleared`;
  }
  if (a.embargo_until && a.embargo_until.trim() !== '') {
    const embargo = new Date(a.embargo_until.replace(' ', 'T') + (a.embargo_until.includes('Z') ? '' : 'Z'));
    if (!isNaN(embargo.getTime()) && embargo.getTime() > Date.now()) {
      return `embargoed until ${a.embargo_until}`;
    }
  }
  if (!a.verified && (a.source_type || 'Own reporting') !== 'Own reporting') {
    return `source "${a.source_type}" is not verified`;
  }
  return null;
}

async function audit(env: Env, action: string, articleId: string | null, before: string | null, after: string | null, details: string) {
  const auditId = `aud-sched-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await env.DB.prepare(`
    INSERT INTO audit_log (
      id, user_id, user_email, action, article_id, before_status, after_status, ip, details, created_at
    ) VALUES (?, 'system-scheduler', 'scheduler@worker.dailyscot.co.uk', ?, ?, ?, ?, NULL, ?, datetime('now'))
  `)
    .bind(auditId, action, articleId, before, after, details)
    .run();
}

async function runScheduler(env: Env): Promise<void> {
  // Each step runs independently so one failure doesn't stop the others
  await publishDueArticles(env).catch((err) => console.error('publishDueArticles failed:', err));
  await expireBreakingNews(env).catch((err) => console.error('expireBreakingNews failed:', err));
  await cleanUpRateLimits(env).catch((err) => console.error('cleanUpRateLimits failed:', err));
}

async function publishDueArticles(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(`
    SELECT id, title, published_at, legal_check, legal_checked, embargo_until, verified, source_type
    FROM articles
    WHERE status = 'scheduled'
      AND published_at IS NOT NULL
      AND datetime(published_at) <= datetime('now')
  `).all<ScheduledArticle>();

  let publishedCount = 0;

  for (const article of results || []) {
    // Re-check the editorial rules at go-live time (the story may have changed since it was scheduled)
    const reason = blockReason(article);
    if (reason) {
      await env.DB.prepare(`
        UPDATE articles SET status = 'needs_review', updated_at = datetime('now')
        WHERE id = ? AND status = 'scheduled'
      `)
        .bind(article.id)
        .run();
      await audit(
        env,
        'SCHEDULED_PUBLISH_BLOCKED',
        article.id,
        'scheduled',
        'needs_review',
        `Did not publish "${article.title}": ${reason}. Moved back to needs_review.`
      );
      continue;
    }

    await env.DB.prepare(`
      UPDATE articles
      SET status = 'published', updated_at = datetime('now')
      WHERE id = ? AND status = 'scheduled'
    `)
      .bind(article.id)
      .run();

    await audit(
      env,
      'SCHEDULED_PUBLISH',
      article.id,
      'scheduled',
      'published',
      `Automated publish of "${article.title}" (scheduled for ${article.published_at} UTC)`
    );
    publishedCount++;
  }

  return publishedCount;
}

async function expireBreakingNews(env: Env): Promise<void> {
  await env.DB.prepare(`
    UPDATE articles
    SET is_breaking = 0, breaking_until = NULL, updated_at = datetime('now')
    WHERE is_breaking = 1
      AND breaking_until IS NOT NULL
      AND datetime(breaking_until) <= datetime('now')
  `).run();
}

async function cleanUpRateLimits(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?')
    .bind(Math.floor(Date.now() / 1000))
    .run();
}
