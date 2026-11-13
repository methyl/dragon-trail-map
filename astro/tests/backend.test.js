import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, normalizeEmail, digest, CONSENT_TEXT, confirmationMessage } from '../server/waitlist.js';

// Real SQLite SQL, with the D1 prepared-statement contract. No real network sends.
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));
  return { raw: db, prepare(sql) { const statement = db.prepare(sql); let args = []; return { bind(...values) { args = values; return this; }, async first() { return statement.get(...args) || null; }, async run() { return statement.run(...args); } }; }, async batch(statements) { return Promise.all(statements.map(x => x.run())); } };
}
const request = (body, options = {}) => new Request('https://dragontrail.pl/api/subscribe', { method: options.method || 'POST', headers: { 'Content-Type': 'application/json', Origin: options.origin || 'https://dragontrail.pl', 'CF-Connecting-IP': options.ip || '192.0.2.1' }, ...(options.method === 'GET' ? {} : { body: JSON.stringify(body) }) });
function fixture(t) {
  const db = database(), sent = [];
  const env = { DB: db, PUBLIC_ORIGIN: 'https://dragontrail.pl', WAITLIST_ENABLED: '1', CF_ACCOUNT_ID: 'a'.repeat(32), CF_EMAIL_API_TOKEN: 'test-only', RATE_LIMIT_SECRET: 'test-only-secret-'.repeat(3), EMAIL_FROM: 'powiadomienia@dragontrail.pl' };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/email/sending/send`);
    const message = JSON.parse(init.body); sent.push(message);
    return Response.json({ success: true, result: { delivered: [], queued: [message.to], permanent_bounces: [] } });
  };
  t.after(() => { globalThis.fetch = original; db.raw.close(); });
  const tokens = () => ({ confirm: sent.at(-1).text.match(/potwierdz\/\?token=([a-f0-9]+)/)[1], cancel: sent.at(-1).text.match(/wypisz\/\?token=([a-f0-9]+)/)[1] });
  const subscribe = (email = 'runner@example.com', options = {}) => handle(request({ email, consent: true }, options), env, 'subscribe');
  return { db, env, sent, subscribe, tokens };
}
test('email validation blocks injection, handles casing and plus tags', () => {
  assert.equal(normalizeEmail(' RUN+tag@Example.com '), 'run+tag@example.com');
  for (const bad of ['x@y', 'a..b@foo.com', '.x@foo.com', 'a@b.com\r\nBcc:x@y.com', 'a<>@b.com', 'a b@b.com', 'a'.repeat(65)+'@b.com']) assert.equal(normalizeEmail(bad), null);
  assert.match(CONSENT_TEXT, /jeden e-mail/);
});
test('new address remains pending until explicit POST, hashes stored not tokens', async t => {
  const f = fixture(t);
  assert.equal((await f.subscribe()).status, 202);
  const row = f.db.raw.prepare('SELECT * FROM waitlist_subscribers').get();
  const { confirm, cancel } = f.tokens();
  assert.equal(row.status, 'pending'); assert.equal(row.confirm_hash, await digest(confirm)); assert.equal(row.unsubscribe_hash, await digest(cancel));
  assert.ok(!JSON.stringify(row).includes(confirm));
  assert.equal((await handle(request({}, { method: 'GET' }), f.env, 'confirm')).status, 405);
  assert.equal(f.db.raw.prepare('SELECT status FROM waitlist_subscribers').get().status, 'pending');
  assert.equal((await handle(request({ token: confirm }), f.env, 'confirm')).status, 200);
  assert.equal(f.db.raw.prepare('SELECT status FROM waitlist_subscribers').get().status, 'confirmed');
  assert.equal((await handle(request({ token: confirm }), f.env, 'confirm')).status, 400);
});
test('double clicks/concurrent duplicates send only once; confirmed users receive no email', async t => {
  const f = fixture(t);
  const responses = await Promise.all([f.subscribe(), f.subscribe()]);
  assert.equal(f.sent.length, 1); assert.equal(await responses[0].text(), await responses[1].text());
  await handle(request({ token: f.tokens().confirm }), f.env, 'confirm');
  await f.subscribe(); assert.equal(f.sent.length, 1);
});
test('expired and forged tokens cannot confirm', async t => {
  const f = fixture(t); await f.subscribe();
  f.db.raw.exec('UPDATE waitlist_subscribers SET expires_at=1');
  assert.equal((await handle(request({ token: f.tokens().confirm }), f.env, 'confirm')).status, 400);
  assert.equal((await handle(request({ token: 'f'.repeat(64) }), f.env, 'confirm')).status, 400);
  assert.equal((await handle(request({ token: "' OR 1=1 --" }), f.env, 'confirm')).status, 400);
});
test('unsubscribe invalidates pending confirmation and is idempotent even when signup disabled', async t => {
  const f = fixture(t); await f.subscribe(); const tokens = f.tokens(); f.env.WAITLIST_ENABLED = '0';
  assert.equal((await handle(request({ token: tokens.cancel }), f.env, 'unsubscribe')).status, 200);
  assert.equal((await handle(request({ token: tokens.confirm }), f.env, 'confirm')).status, 400);
  assert.equal((await handle(request({ token: tokens.cancel }), f.env, 'unsubscribe')).status, 200);
  assert.equal(f.db.raw.prepare('SELECT status FROM waitlist_subscribers').get(), undefined);
});
test('deleted addresses can request a fresh DOI, never auto-confirm', async t => {
  const f = fixture(t); await f.subscribe(); const old = f.tokens();
  await handle(request({ token: old.cancel }), f.env, 'unsubscribe');
  f.db.raw.exec('UPDATE waitlist_subscribers SET last_sent_at=1');
  await f.subscribe(); assert.equal(f.sent.length, 2);
  assert.equal(f.db.raw.prepare('SELECT status FROM waitlist_subscribers').get().status, 'pending');
  assert.equal((await handle(request({ token: old.confirm }), f.env, 'confirm')).status, 400);
});
test('configuration fails closed; consent and Origin required; honeypot neutral', async t => {
  const f = fixture(t);
  assert.equal((await f.subscribe('a@example.com', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await handle(request({ email: 'a@example.com' }), f.env, 'subscribe')).status, 400);
  assert.equal((await handle(request({ email: 'a@example.com', consent: true, website: 'bot' }), f.env, 'subscribe')).status, 202);
  f.env.WAITLIST_ENABLED = '0'; assert.equal((await f.subscribe()).status, 503);
  assert.equal(f.sent.length, 0);
});
test('large or wrong-type bodies rejected before DB', async t => {
  const f = fixture(t);
  assert.equal((await handle(request({ junk: 'a'.repeat(5000) }), f.env, 'subscribe')).status, 400);
  const r = new Request('https://dragontrail.pl/api/subscribe', { method: 'POST', headers: { Origin: 'https://dragontrail.pl' }, body: 'email=test' });
  assert.equal((await handle(r, f.env, 'subscribe')).status, 400);
});
test('IP limit is atomic and stores no raw IP', async t => {
  const f = fixture(t);
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => f.subscribe(`runner${i}@example.com`)));
  assert.equal(responses.filter(r => r.status === 429).length, 3); assert.equal(f.sent.length, 5);
  assert.ok(!JSON.stringify(f.db.raw.prepare('SELECT * FROM waitlist_rate_limits').all()).includes('192.0.2.1'));
});
test('per-address daily cap cannot be bypassed by changing IP', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) { await f.subscribe(undefined, { ip: `192.0.2.${i}` }); f.db.raw.exec('UPDATE waitlist_subscribers SET last_sent_at=1'); }
  assert.equal(f.sent.length, 3);
});
test('provider failure is not success and does not erase valid possibly delivered token', async t => {
  const f = fixture(t); globalThis.fetch = async () => { throw new Error('timeout'); };
  assert.equal((await f.subscribe()).status, 503);
  const row = f.db.raw.prepare('SELECT * FROM waitlist_subscribers').get();
  assert.equal(row.status, 'pending'); assert.ok(row.confirm_hash);
});
test('provider success with hard bounce not reported as sent', async t => {
  const f = fixture(t); globalThis.fetch = async () => Response.json({ success: true, result: { permanent_bounces: ['runner@example.com'], queued: [], delivered: [] } });
  assert.equal((await f.subscribe()).status, 503);
});
test('global daily send limit caps service cost/abuse', async t => {
  const f = fixture(t); const day = Math.floor(Date.now() / 1000 / 86400);
  f.db.raw.prepare('INSERT INTO waitlist_rate_limits VALUES (?,100,?)').run(`send:${day}`, Date.now());
  assert.equal((await f.subscribe()).status, 503); assert.equal(f.sent.length, 0);
});

test('retention deletes old pending and notified records, preserves recent confirmed', async t => {
  const { prune } = await import('../server/retention.js');
  const f = fixture(t); await f.subscribe();
  const now = Math.floor(Date.now() / 1000);
  f.db.raw.prepare('UPDATE waitlist_subscribers SET updated_at=?').run(now - 8 * 86400);
  await prune(f.db, now);
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM waitlist_subscribers').get().n, 0);
  await f.subscribe('second@example.com');
  await handle(request({ token: f.tokens().confirm }), f.env, 'confirm');
  await prune(f.db, now);
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM waitlist_subscribers').get().n, 1);
  f.db.raw.prepare('UPDATE waitlist_subscribers SET notified_at=?').run(now - 31 * 86400);
  await prune(f.db, now);
  assert.equal(f.db.raw.prepare('SELECT count(*) n FROM waitlist_subscribers').get().n, 0);
});


test('confirmation email uses owner wording, signature and REST reply_to', () => {
  const message = confirmationMessage('runner@example.com', 'a'.repeat(64), 'b'.repeat(64), 'https://dragontrail.pl', 'powiadomienia@dragontrail.pl');
  assert.equal(message.reply_to, 'lucjan@dragontrail.pl');
  assert.equal(message.to, 'runner@example.com');
  assert.equal(message.from, 'powiadomienia@dragontrail.pl');
  assert.match(message.text, /chcesz otrzymać wiadomość, gdy ruszą/);
  assert.doesNotMatch(message.text, /chcesz otrzymać jeden e-mail/);
  assert.match(message.text, /\n\nLucjan Suski\nNowy Żmigród Dragon Trail\nhttps:\/\/dragontrail.pl$/);
});
