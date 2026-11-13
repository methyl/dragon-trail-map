import { prune } from '../server/retention.js';
export default {
  async scheduled(_controller, env, ctx) { ctx.waitUntil(prune(env.DB)); },
  async fetch() { return new Response('Not found', { status: 404 }); },
};
