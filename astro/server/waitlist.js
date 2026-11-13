import { prune } from './retention.js';
/** Cloudflare Pages Functions: server-only D1 / Cloudflare Email Sending implementation. */
export const CONSENT_VERSION = 'registration-opening-2027-v1';
export const CONSENT_TEXT = 'Chcę otrzymać jeden e-mail o uruchomieniu zapisów na Nowy Żmigród Dragon Trail 2027.';
const HOUR = 3600;
const DAY = HOUR * 24;
const GENERIC = { ok: true, message: 'Jeśli adres wymaga potwierdzenia, wyślemy na niego wiadomość. Sprawdź także spam.' };
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const error = (message, status) => json({ ok: false, message }, status);
const tokenOK = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export const normalizeEmail = value => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  // ASCII mailbox syntax only; deliberately reject header injection and display-name syntax.
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) return null;
  const local = email.split('@')[0];
  return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? email : null;
};
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
async function ipKey(ip, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)));
}
export function settings(env) {
  let origin;
  try { origin = new URL(env.PUBLIC_ORIGIN).origin; } catch { return null; }
  if (!origin.startsWith('https://') || !env.DB) return null;
  return { origin };
}
async function payload(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length')) > 4096) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0, chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(x => [...x])))); return data && typeof data === 'object' && !Array.isArray(data) ? data : null; } catch { return null; }
}
async function rate(db, key, expiry, limit) {
  // Atomic limit reservation, including simultaneous requests from separate Workers.
  return Boolean(await db.prepare(`INSERT INTO waitlist_rate_limits(key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`).bind(key, expiry, limit).first());
}
export function confirmationMessage(email, confirm, cancel, origin, sender) {
  const confirmURL = `${origin}/potwierdz/?token=${confirm}`;
  const cancelURL = `${origin}/wypisz/?token=${cancel}`;
  return { from: sender, to: email, subject: 'Potwierdź powiadomienie o zapisach — Dragon Trail',
    text: `Cześć!\n\nPotwierdź, że chcesz otrzymać jeden e-mail, gdy ruszą zapisy na Nowy Żmigród Dragon Trail 2027:\n${confirmURL}\n\nNa stronie kliknij „Potwierdzam”. Link jest ważny przez 48 godzin.\n\nJeśli to nie Ty podałeś ten adres, zignoruj tę wiadomość. Bez potwierdzenia nie wyślemy powiadomienia o zapisach.\n\nAnuluj zgłoszenie: ${cancelURL}\n\nNowy Żmigród Dragon Trail\nhttps://dragontrail.pl` };
}
async function send(env, message) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true || result.result?.permanent_bounces?.includes(message.to)) throw new Error('email-provider-unavailable');
  if (!result.result?.delivered?.includes(message.to) && !result.result?.queued?.includes(message.to)) throw new Error('email-not-accepted');
}
export async function handle(request, env, action) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  const config = settings(env);
  if (!config) return error('Zapisy na powiadomienie są chwilowo niedostępne.', 503);
  if (request.headers.get('origin') !== config.origin) return error('Nieprawidłowe źródło żądania.', 403);
  const data = await payload(request);
  if (!data) return error('Nieprawidłowe dane.', 400);
  const now = Math.floor(Date.now() / 1000);
  try {
    if (action === 'subscribe') {
      // Fail closed until sender setup, approved template, secrets and an explicit enable flag exist.
      if (now >= Date.parse('2027-05-15T00:00:00Z') / 1000 || env.WAITLIST_ENABLED !== '1' || !/^[a-f0-9]{32}$/i.test(env.CF_ACCOUNT_ID || '') || !env.CF_EMAIL_API_TOKEN || !env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32 || !normalizeEmail(env.EMAIL_FROM)) return error('Zapisy na powiadomienie są chwilowo niedostępne.', 503);
      if (data.website) return json(GENERIC, 202); // honeypot
      const email = normalizeEmail(data.email);
      if (!email || data.consent !== true) return error('Podaj poprawny adres e-mail i zaznacz zgodę na powiadomienie.', 400);
      const ip = request.headers.get('cf-connecting-ip');
      if (!ip) return error('Nie udało się zweryfikować zgłoszenia. Spróbuj ponownie.', 503);
      const hour = Math.floor(now / HOUR);
      if (!await rate(env.DB, `ip:${await ipKey(ip, env.RATE_LIMIT_SECRET)}:${hour}`, now + 2 * HOUR, 5)) return error('Za dużo prób. Spróbuj ponownie za godzinę.', 429);
      // Per-address quota spans resends; addresses are hashed in the temporary counter table.
      if (!await rate(env.DB, `email:${await ipKey(email, env.RATE_LIMIT_SECRET)}:${Math.floor(now / DAY)}`, now + 2 * DAY, 3)) return json(GENERIC, 202);
      const confirm = token(), cancel = token();
      const confirmHash = await digest(confirm), cancelHash = await digest(cancel);
      const row = await env.DB.prepare(`INSERT INTO waitlist_subscribers
        (email,status,confirm_hash,unsubscribe_hash,expires_at,created_at,updated_at,last_sent_at,consent_version)
        VALUES (?,'pending',?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET
        status='pending',confirm_hash=excluded.confirm_hash,unsubscribe_hash=excluded.unsubscribe_hash,
        expires_at=excluded.expires_at,updated_at=excluded.updated_at,last_sent_at=excluded.last_sent_at,
        consent_version=excluded.consent_version,confirmed_at=NULL,notified_at=NULL
        WHERE waitlist_subscribers.status!='confirmed' AND waitlist_subscribers.last_sent_at <= ?
        RETURNING email`).bind(email, confirmHash, cancelHash, now + 2 * DAY, now, now, now, CONSENT_VERSION, now - 900).first();
      if (!row) return json(GENERIC, 202);
      if (!await rate(env.DB, `send:${Math.floor(now / DAY)}`, now + 2 * DAY, 100)) return error('Zapisy na powiadomienie są chwilowo niedostępne. Spróbuj jutro.', 503);
      try { await send(env, confirmationMessage(email, confirm, cancel, config.origin, env.EMAIL_FROM)); }
      catch {
        // A timeout might have delivered the message. Preserve its token and cooldown; never blindly retry.
        console.error('waitlist_email_send_failed');
        return error('Nie udało się potwierdzić wysłania wiadomości. Sprawdź skrzynkę; jeśli jej nie ma, spróbuj za 15 minut.', 503);
      }
      // Short-lived abuse records. Pending records older than 7 days are also pruned.
      await prune(env.DB, now);
      return json(GENERIC, 202);
    }
    if (!tokenOK(data.token)) return error('Link jest nieprawidłowy lub wygasł.', 400);
    const hash = await digest(data.token);
    if (action === 'confirm') {
      const row = await env.DB.prepare(`UPDATE waitlist_subscribers SET status='confirmed',confirmed_at=?,updated_at=?,confirm_hash=NULL
        WHERE confirm_hash=? AND status='pending' AND expires_at>? RETURNING email`).bind(now, now, hash, now).first();
      return row ? json({ ok: true, message: 'Potwierdzone! Damy Ci znać, gdy ruszą zapisy.' }) : error('Link wygasł, został już użyty albo zgłoszenie anulowano.', 400);
    }
    if (action === 'unsubscribe') {
      await env.DB.prepare('DELETE FROM waitlist_subscribers WHERE unsubscribe_hash=?').bind(hash).run();
      return json({ ok: true, message: 'Adres został usunięty z listy. Nie wyślemy powiadomienia o zapisach.' });
    }
    return error('Nie znaleziono.', 404);
  } catch {
    console.error('waitlist_request_failed'); // Never log email, token, body, URL, or provider response.
    return error('Usługa jest chwilowo niedostępna. Spróbuj ponownie później.', 503);
  }
}
