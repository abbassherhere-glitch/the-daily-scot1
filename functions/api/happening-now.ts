import { Env, EventContext } from '../types';
import { happeningNow } from '../utils/contentUpdated';
import { HAPPENING_NOW_MINUTES, HAPPENING_NOW_STORIES } from '../../src/config/updates';

/** Up to three live stories published or changed in the last hour, for the strip at the top of the homepage. */
export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const articles = await happeningNow(context.env.DB, HAPPENING_NOW_MINUTES, HAPPENING_NOW_STORIES);
    return new Response(JSON.stringify({ articles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  } catch (err) {
    console.error('Happening now fetch failed:', err);
    return new Response(JSON.stringify({ articles: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
