import { Env, EventContext, User } from '../../types';

export async function onRequestGet(
  context: EventContext<Env, any, { user: User }>
): Promise<Response> {
  const user = context.data.user;
  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
