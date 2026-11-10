import { Env, EventContext } from '../types';
import { closuresLastUpdated, loadClosures, transportStories } from '../utils/closures';

/**
 * GET /api/closures: every closure the public should see (most important first), when the list last
 * changed, and the latest transport stories. Used by the closures page, the homepage panel and the
 * "Live travel" line under the header.
 */
export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const db = context.env.DB;
    const [closures, updatedAt, stories] = await Promise.all([
      loadClosures(db),
      closuresLastUpdated(db),
      transportStories(db).catch(() => []),
    ]);
    return new Response(JSON.stringify({ closures, updatedAt, stories }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  } catch (err) {
    console.error('Closures fetch failed:', err);
    return new Response(JSON.stringify({ closures: [], updatedAt: null, stories: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
