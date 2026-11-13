# Nowy Żmigród Dragon Trail

One Astro project: `/` (landing), `/mapa/` (MapLibre/Leaflet map), and double-opt-in notification pages. Cloudflare Pages Functions and D1 implement the waitlist.

## Local development

Node 22+ recommended. `npm ci`, then `npm run dev`. `npm test` includes geometry, renderer, backend and production-worker tests. `npm run build` produces `dist/`. Where the home directory is not writable, set `ASTRO_TELEMETRY_DISABLED=1` and an npm cache under a writable folder.

`npm run preview` previews static assets only; use `wrangler pages dev dist` for integrated Functions/D1 testing. See `docs/waitlist-operations.md` for required bindings, migrations and email setup.

## Publication gates

`PUBLIC_SIGNUP_ENABLED=true` enables the form at build time. The backend also independently requires `WAITLIST_ENABLED=1` and all required bindings/secrets. Both default to disabled. Complete and verify the controller's privacy notice before collecting email addresses. Do not deploy placeholder secrets or IDs. Do not change existing MX records for Google Workspace when enabling outgoing email.

The preserved landing source is Sites version10, commit fcda706. Map source/data reflect GitHub commit c803a29 (33.53km, +1324m and11.77km,+421m). Both original sources remain unchanged locally. Runtime sources/attribution are available in the map.

## Routes

- `/`: existing24-frame landscape and serif dragon logo, race cards, map links and notification form.
- `/mapa/`: interactive map and GPX downloads. Optional `?trasa=10k`.
- `/potwierdz/?token=…`: explicit confirmation POST; no state changes on GET.
- `/wypisz/?token=…`: explicit unsubscribe POST.
- `/prywatnosc/`: privacy notice, must be completed before signup activation.

Cloudflare Pages build command: `npm run build`; output: `dist`; Functions directory: `functions` at repository root.
