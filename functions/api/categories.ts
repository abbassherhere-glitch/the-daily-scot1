import { Env, EventContext } from '../types';

export async function onRequestGet(context: EventContext<Env, any, any>): Promise<Response> {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT slug, name, description, sort_order FROM categories ORDER BY sort_order ASC'
    ).all();

    return new Response(JSON.stringify({ categories: results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Failed to retrieve categories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
