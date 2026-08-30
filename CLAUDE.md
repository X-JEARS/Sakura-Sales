# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

樱花场贩 (Sakura Sales) — an order-entry and sales-statistics PWA for on-site event staff, built entirely on Cloudflare (Workers + D1 + R2 + KV + static assets). No external server. Staff (not customers) enter orders; admins manage events, products, and accounts. No public registration — all accounts are created internally by admins.

## Commands

```bash
npm run dev              # local SPA preview at http://127.0.0.1:8765 (uses demo data admin/admin; orders saved to localStorage)
npm run check            # syntax check: node --check worker.js && node --check public/app.js  (run before every deploy)
npm test                 # focused frontend runtime, routing, and Worker API tests
npm run icons:generate   # regenerate public/antd-icons.js from antd-mobile-icons (run only when icon set changes)

npx wrangler deploy                                          # deploy Worker + assets to Cloudflare
npx wrangler d1 execute field-market-orders --remote --file=schema.sql   # apply/migrate D1 schema
node scripts/hash-password.mjs '<password>'                  # PBKDF2 hash for seeding a user
```

There is no linter or bundler. `npm test` runs the focused Node test suite, while `npm run check` performs syntax checks. The "build" is just syncing the PWA cache version (below).

## Architecture

### Two runtime modes (app.js)
`boot()` calls `/api/bootstrap`; localhost/127.0.0.1 falls back to `seedDemo()` (in-memory demo data + `localStorage` persistence), while other hosts show the login screen. Demo writes and image Data URL fallback are guarded by `canUseDemoFallback()`; production request failures preserve state and show an error. The same function often has a `baseX` + reassigned `actions`/`submitForm` pattern where a later block monkey-patches the earlier one (e.g. account editing was layered on top of the original); edit the final assigned function, not just `baseActions`.

### Rendering model (app.js)
Single IIFE holding a `state` object. `render()` rewrites `#app.innerHTML` from `state` and `bindEvents()` re-attaches all handlers — there is no virtual DOM or diffing. `syncCheckout()` is the one partial-update path (patches only the checkout bar during stepper input); if you touch cart logic, keep it in sync with `checkoutBarHTML()`. `public/app-runtime.js` owns pure route, event-state, and password-confirmation helpers; `app.js` uses History API `pushState`/`popstate` for event, edit, reports, orders, accounts, audit, and settings routes.

### Worker (worker.js)
One `fetch` handler, no router library. Request flow: `/media/*` → R2 passthrough (cached immutable); non-`/api/*` → `env.ASSETS` with SPA fallback to `/index.html`; `/api/*` → strip prefix, then a dense `if (path === ... && method === ...) return ...` chain using regex matches for parameterized routes. All `/api/*` routes (except `/auth/login`) require `sessionUser()`. Keep this single-file, inline style — it is intentional.

### Auth & authorization
- Passwords: PBKDF2 (SHA-256, 100k iterations, 16-byte salt), format `base64(salt).base64(digest)`. `hashPassword`/`verifyPassword` in worker.js; `scripts/hash-password.mjs` mirrors it for seeding.
- Sessions: random 32-byte hex token sent as HttpOnly `sid` cookie; only its SHA-256 digest is stored in `sessions` (7-day expiry). `sessionUser` joins `sessions`→`users` and requires `status='active'`.
- Roles: `super_admin` / `admin` / `event_admin` / `operator`. Guards: `canUseEvent` (super_admin/admin OR `event_members` row), `canManageEvent` (super_admin/admin/event_admin). Only `super_admin` can create/assign `admin`. Users cannot disable their own account or change their own role, and no caller may change a `super_admin` user's role or status (enforced in `/users/:id` PATCH). Password changes require matching confirmation in the frontend before submission.

### Money model (cross-cuts schema, worker, app.js)
All amounts are **integer minor units** (`price_minor`, `*_amount_minor`, `threshold_minor`). Frontend converts to major for display/input: `majorAmount = minor/100`, `minorAmount = round(major*100)`. `decorateModal('product'|'gift')` swaps the numeric `*_minor` input for a `*_major` text input plus a hidden `*_minor` input kept in sync on each keystroke — the submitted `FormData` therefore carries the minor value. The `events.currency_scale` column (default 2) exists in schema but the frontend **hardcodes /100**; do not assume JPY-scale (0) works without wiring `currency_scale` through both sides. `currency_unit` lives on the event (CNY/HKD/JPY/USD); `normalizeCurrency`/`currencyUnit` also accept legacy Chinese labels (元/港币/…).

### Gift computation (duplicated, server-authoritative)
`computeGifts(net, rules)` in worker.js and `calcCart()` in app.js implement the same rule: filter rules with `threshold_minor <= max(0, net)`; `cumulative` mode → `qty = floor(net / threshold)`; `highest` mode → `qty = 1` only for the single highest matched threshold. **The server recomputes from `gift_rules` on order submit and writes name/quantity snapshots to `order_gifts`** — the client calculation is display-only. If you change the rule, update both.

### Orders & idempotency
`POST /events/:id/orders` requires `client_request_id` (UNIQUE); a duplicate returns the existing order instead of creating one. Orders are allowed only when `event.manual_status === 'open'`: the frontend disables and guards submission for every other status, and the Worker remains authoritative with a `409` rejection. Server re-reads active products to compute line amounts (client-sent prices are not trusted) and batches the order + items + gifts in one `env.DB.batch()`.

### Reporting & order details
The reports screen filters confirmed orders by date, shows net sales, sales, returns, product quantities, return quantities, and gift totals, and exports item-level CSV. CSV amount values are converted from minor units to major units with two decimal places; the currency unit belongs in the amount column header, not in each value. `GET /orders/:id` returns the order together with item and gift snapshots for the order-detail modal.

### Event deletion
`DELETE /events/:id` is restricted to `super_admin` and `admin` and permanently removes the event plus its orders, order items, gifts, products, event members, and audit logs. This is the intentional exception to the soft-delete rules below; the UI exposes the destructive action only on the event edit screen.

### Soft deletes
Products (`active=0`) and gift rules (`active=0`) are never hard-deleted. Cancelling an order sets `status='cancelled'`; cancelled orders are excluded from sales statistics but kept for audit. Event deletion is the separate permanent-cleanup operation described above. Bootstrap queries filter products and gift rules with `active=1`.

### Event cards
Event cards do not display the event URL as text. The `enter` action is on the right, with data/reports, edit, and copy-link actions to its left; destructive event deletion is available from the edit screen only.

### Images (R2)
Uploaded via `POST /events/:id/images` (raw body, content-type derived extension, ≤5MB, JPG/PNG/WebP/GIF) to key `events/{eventId}/{uuid}.{ext}`, served from `/media/{key}`. Editing a product's image and `remove-image` both delete the prior R2 object via `r2Key()` (best-effort `.catch(()=>{})`). The `uploadImage` helper falls back to a `FileReader` data URL when the API is unreachable (demo mode).

### Icons
`public/antd-icons.js` is **generated** (`npm run icons:generate`) from `antd-mobile-icons` and exposes `window.ANTD_ICONS` (48×48 viewBox). `icon(name)` in app.js prefers `window.ANTD_ICONS[name]` and falls back to an inline 24×24 SVG `paths` map. To add a one-off icon, add it to the inline `paths` map — no regeneration needed. The generated file uses `fill="currentColor"`; the inline fallbacks use `stroke="currentColor"`.

### i18n & theme
Five locales (zh-CN/zh-TW/zh-HK/en/ja) in two objects: `T` (core) and `EXTRA` (management strings), merged at load. zh-HK spreads zh-TW then overrides local wording. `t(key)` falls back to zh-CN then the raw key. When adding a visible string, add it to **all five** locale entries in both `T` and `EXTRA` as applicable. Theme (light/dark/system) sets `data-theme` on `<html>` and syncs `<meta name="theme-color">` from the computed `--bg` CSS var.

## Deploy checklist

Every deploy must bump the PWA cache version **in all three places together**, or a stale service-worker shell lingers for users:

- `public/index.html` — `?v=N` on `styles.css`, `antd-icons.js`, `app-runtime.js`, `app.js`
- `public/app.js` — `navigator.serviceWorker.register('/sw.js?v=N')`
- `public/sw.js` — `CACHE = 'field-orders-shell-vN'` and matching `?v=N` entries in `SHELL`, including `app-runtime.js`

Then `npm run check && npm test && npx wrangler deploy`. Redeploy is data-safe (D1/R2 persist). The current application version is `0.4.0` and the current PWA cache version is `v39`; both are tracked in `DEVELOPMENT.md`.
