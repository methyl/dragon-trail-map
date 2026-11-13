import { handle } from '../../server/waitlist.js';
export const onRequest = ({ request, env }) => handle(request, env, 'confirm');
