# Registration-opening notification: deployment and verification

This is a single-event notification list, not a newsletter. Frontend checkbox must use the meaning of `CONSENT_TEXT` in `server/waitlist.js` and link to the completed privacy notice. Only `confirmed` rows may receive the eventual registration-opening message. This implementation does **not** automatically broadcast that message.

Administrator danych wskazany przez właściciela: Lucjan Suski, lucjan@dragontrail.pl.

## Status / launch gates

Code and offline integration tests are implemented. No real email has been sent, no Cloudflare database/domain/billing resource has been provisioned by this implementation. Subscription handling is fail-closed unless `WAITLIST_ENABLED=1` and all mandatory settings exist. Do not enable before confirming the completed privacy notice, domain configuration, permissions and the actual end-to-end inbox check. The owner must approve email content/recipients according to their saved email rule before enabling automated outgoing messages.

## Cloudflare requirements (official docs checked 13 November 2026)

- Email Sending is the outbound product, currently Beta. Email Routing alone is not arbitrary-recipient transactional sending.
- Email Sending to unverified/arbitrary recipients requires Workers Paid. The email quota includes 3,000 emails/month, then USD 0.35 per 1,000, in addition to the Workers plan. Do not upgrade billing without the owner's authorized spending scope.
- Onboard the sender domain using Cloudflare DNS. Review DKIM/SPF/DMARC; the documented bounce records use `cf-bounce`. **Do not replace apex Google Workspace MX records** or enable inbound Routing as a substitute for sending. Check existing policies before modifying DNS.
- New accounts have daily sending limits that scale with reputation. Do not assume a quota from documentation; check the account.
- This Pages backend calls the Cloudflare Email Sending REST API, so it does not rely on `send_email` being supported by Pages bindings.

Sources:
https://developers.cloudflare.com/email-service/get-started/send-emails/
https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
https://developers.cloudflare.com/email-service/platform/pricing/
https://developers.cloudflare.com/email-service/platform/limits/
https://developers.cloudflare.com/api/resources/email_sending/methods/send/

## Bindings / variables / secrets

D1 binding: `DB`, database `dragon-trail-waitlist`.

Runtime variables:
- `PUBLIC_ORIGIN`: exact canonical HTTPS origin, e.g. `https://dragontrail.pl`. Requests from other origins (including preview hosts) are rejected. Set separately for an intentionally approved test environment.
- `WAITLIST_ENABLED`: `0` until launch gates pass; explicitly `1` to enable new subscriptions. Confirm/cancel remain usable when signup is disabled.
- `CF_ACCOUNT_ID`: Cloudflare account ID.
- `EMAIL_FROM`: onboarded sending address, e.g. `powiadomienia@dragontrail.pl` after approval.

Secrets, stored only in Cloudflare, never committed:
- `CF_EMAIL_API_TOKEN`: scoped to Email Sending: Edit in the relevant account, **not** a global API key. The token does not need DNS or account administration permission.
- `RATE_LIMIT_SECRET`: random secret with at least 32 characters for HMAC abuse buckets. Generate with a cryptographic RNG; do not reuse other credentials.

Frontend build flag: `PUBLIC_SIGNUP_ENABLED=true` only after launch gates pass. All security gates are checked server-side too.

Create D1/bind it through the deployment workflow, apply `migrations/0001_waitlist.sql` before enabling. Select the EU location/jurisdiction option when supported and appropriate; verify exact location requirements with the controller rather than promising all processing remains in the EU. D1 remote commands need explicit production targeting, never run `--remote` against a guessed account.

## API contract

- POST `/api/subscribe`: JSON `{email, consent: true, website: ''}`. 202 is neutral: pending, already pending, already confirmed, or honeypot suppression. It is **not** evidence of confirmed subscription or delivery. No email addresses are returned.
- `/potwierdz/?token=...` displays a confirmation button. POST `/api/confirm`: JSON `{token}`. A GET never activates a subscription, avoiding link scanners confirming addresses.
- `/wypisz/?token=...` displays a cancel button. POST `/api/unsubscribe`: JSON `{token}`. Deletes the address; idempotent neutral success for unknown tokens. A subsequent opt-in requires a fresh confirmation.
- 400: invalid/expired token or invalid input; 403: wrong origin; 405: method; 429: IP limit; 503: unavailable/disabled/configuration/provider failure.

Token pages must set `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and contain **no third-party analytics/assets** that receive tokens/referrers. Do not log request URLs/bodies on these routes. Use normal browser button POST, not GET-side effects.

## Safeguards

32-byte random confirmation/cancellation tokens; SHA-256 hashes only in D1; 48-hour confirmation expiry; single-use confirmation; atomic SQLite statements for concurrency; email normalization and parameterized SQL; strict JSON body <=4 KB; explicit same-origin check; honeypot; five requests/IP/hour; three confirmation-send attempts/address/day; 15-minute cooldown; max100 sends/day per app. Temporary rate buckets use HMAC identifiers, not raw IPs. No tracking pixels or extra personal data.

If a send times out, the provider may have accepted it. We preserve its valid token/cooldown and do not retry automatically. The UI asks the person to check the inbox or wait. Cloudflare reported hard bounces are not treated as successful sends.

## Retention

- Cancellation immediately deletes the subscriber record.
- Pending records older than7 days are purged.
- Confirmed records purge30 days after `notified_at`, or after race day16 May2027, whichever comes first.
- New opt-ins stop on15 May2027.
- Abuse buckets expire within48 hours.
- Request-time cleanup is not enough on an idle site. Deploy the small scheduled cleanup Worker `cloudflare/cleanup.worker.js`, bound to the **same** D1 database, using `cloudflare/wrangler.cleanup.example.jsonc` with the real ID. It runs daily. Do not state scheduled retention is active until its deployment is verified.
- D1 backups/Time Travel and Cloudflare provider logs have their own retention; disclose them in the controller-approved privacy notice. Tokenized URL logging must be disabled/redacted where configurable.

The eventual send job must select only `status='confirmed' AND notified_at IS NULL`, regenerate the unsubscribe token for that message (only hashes are stored), and update `notified_at` on accepted delivery without re-sending ambiguous outcomes. An admin broadcast endpoint has intentionally not been exposed.

## Confirmation email template awaiting owner approval

From: approved sender address
Reply-To: lucjan@dragontrail.pl (REST API field `reply_to`)
Recipient: only the address submitted in the notification form
Subject: Potwierdź powiadomienie o zapisach — Dragon Trail

Cześć!

Potwierdź, że chcesz otrzymać wiadomość, gdy ruszą zapisy na Nowy Żmigród Dragon Trail 2027:
[unique confirmation link]

Na stronie kliknij „Potwierdzam”. Link jest ważny przez48 godzin.

Jeśli to nie Ty podałeś ten adres, zignoruj tę wiadomość. Bez potwierdzenia nie wyślemy powiadomienia o zapisach.

Anuluj zgłoszenie: [unique cancellation link]

Lucjan Suski
Nowy Żmigród Dragon Trail
https://dragontrail.pl

## Verification

`node --test tests/backend.test.js` uses real SQLite, a D1-shaped adapter and a stubbed Cloudflare transport. This verifies SQL/state transitions, hashing, atomic limits, repeated/concurrent submits, CSRF/input bounds, expiry/replay, provider errors and cancellation without sending mail. These are **not** a live D1/provider delivery test.

Before launch, use an explicitly approved test recipient and verify:
1. One confirmation email only after form submit; D1 pending record, no plaintext token.
2. Opening link alone does not confirm; button confirms once; replay and expired links fail.
3. Repeated submit and already-confirmed submit do not spam.
4. Cancellation deletes address and invalidates confirmation.
5. SPF/DKIM/DMARC results, correct links and actual inbox receipt.
6. Preview deployments cannot send via production settings.
7. Scheduled retention worker deployment and next trigger are verified.
