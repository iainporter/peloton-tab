# PelotonTab - Claude Code Context

## Project Overview

PelotonTab is a PWA that tracks shared expenses during group cycling rides. Riders authenticate via Strava, form groups, and the app automatically detects who rode together. When someone pays for the coffee stop, they log the amount and it's split across all riders present. Groups can also create trips (e.g. a getaway to the Alps) to track non-ride expenses in multiple currencies and settle up at the end.

- **PRD**: `PRD.md` — full product requirements
- **Epics**: `epics/` — implementation plan broken into 8 epics (0-7)
- **Build Journal**: `BUILDING.md` — article documenting the build process, update as each epic completes

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL on Neon (serverless) via `@neondatabase/serverless` v0.10
- **ORM**: Drizzle ORM (`drizzle-orm/neon-http` adapter)
- **Auth**: NextAuth.js v5 (Auth.js) with custom Strava OAuth provider
- **PWA**: Serwist (`@serwist/turbopack`) — uses SerwistProvider, not webpack plugin
- **Testing**: Vitest (`npm test`) — unit tests for pure `src/lib` functions
- **Hosting**: Vercel (auto-deploy from `main` branch)
- **Repo**: git@github.com:iainporter/peloton-tab.git

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout with PWA metadata + SerwistProvider
    page.tsx                # Landing page (Strava sign-in or redirect to /groups)
    sw.ts                   # Service worker (Serwist)
    serwist.ts              # Client-side SerwistProvider re-export
    globals.css             # Tailwind config
    ~offline/page.tsx       # Offline fallback
    (app)/                  # Route group — all pages wrapped in AppShell
      layout.tsx            # Fetches session, passes user to AppShell
      groups/page.tsx       # Group list with balance preview
      groups/[id]/          # Group detail: balances, trips, ride activity feed
        rides/              # Ride detail, payments
        trips/actions.ts    # Server actions for trips, trip members, expenses
        trips/new/          # Create trip
        trips/[tripId]/     # Trip detail, settings, settle, expenses/new, expenses/[expenseId]/edit
      rides/page.tsx        # Placeholder
      profile/page.tsx      # User profile + sign out
    api/auth/[...nextauth]/ # NextAuth route handler
  components/
    app-shell.tsx           # Header (logo + user avatar) + bottom nav
    ui.tsx                  # Avatar, Button, Input, Card, EmptyState
  db/
    schema.ts               # Full Drizzle schema
    index.ts                # DB connection (neon HTTP driver)
  lib/
    auth.ts                 # NextAuth config, JWT callbacks, token refresh
    strava-provider.ts      # Custom Strava OAuth provider
    balances.ts             # Ride balances per group
    money.ts                # Currencies, minor-unit parsing and formatting (pure)
    trips.ts                # Expense splitting and trip balances (pure)
    trip-data.ts            # Trip queries (ledger, group trip summaries)
    exchange-rates.ts       # Frankfurter (ECB) rate lookup
  middleware.ts             # Protects /groups, /rides, /profile routes
  types/
    next-auth.d.ts          # Extended Session/JWT types
drizzle/                    # Generated migrations
epics/                      # Epic definitions
```

## Key Technical Decisions & Gotchas

### Neon Driver
- **Must use `@neondatabase/serverless` v0.10**, not v1.x. v1 changed `neon()` to tagged-template-only which breaks `drizzle-orm/neon-http`.
- Uses the HTTP driver (`neon-http`), not WebSocket (`Pool`). WebSocket doesn't work on Vercel serverless.
- `db.transaction()` isn't supported on neon-http — use `db.batch([...])` for atomic multi-statement writes. Generate UUIDs with `crypto.randomUUID()` up front when later statements in the batch need the id.

### Strava OAuth
- Custom provider in `src/lib/strava-provider.ts`
- Strava's token endpoint returns an `athlete` object embedded in the response — the `conform` handler strips it
- Uses `client_secret_post` auth method (not Basic auth)
- Token refresh is handled in the NextAuth JWT callback and updates the DB
- `AUTH_SECRET` must be passed explicitly in NextAuth config (env auto-detection unreliable on Vercel)
- `trustHost: true` is set for Vercel deployment
- Sessions are JWTs, so the `session` callback checks the user row still exists and has no `deleted_at` (cached per request, fails open on DB errors). Rejected sessions come back with `user` undefined — returning null from the callback doesn't work server-side, as next-auth substitutes a default session. Always guard with `session?.user?.id`

### Next.js 16 + Serwist
- Next.js 16 uses Turbopack by default — `@serwist/next` (webpack) doesn't work
- Using `@serwist/turbopack` with `SerwistProvider` client component instead
- Middleware shows a deprecation warning about "proxy" — safe to ignore, still works

### Trips
- Trips are a separate ledger from rides — trip expenses never affect group ride balances
- Each expense has its own participants (unlike ride payments, which split across all riders)
- Expenses store the original `amount` + `currency`, the `rate` used, and the converted `base_amount` — balances only sum `base_amount`
- Splits are exact integers (`splitEvenly` in `src/lib/trips.ts`) so trip balances always net to zero — keep money logic in pure functions with tests
- Expenses and trip rates can only change while a trip's status is `open`
- Rates are `numeric(18, 8)` strings (1 unit of currency = rate × base). Convert with `convertToBase` / `deriveRate` (BigInt maths) — never multiply floats. Normalise for display with `parseRate`
- `rate_source`: `base` (same currency), `trip` (trip rate — recalculated when the trip rate changes), `live` (fetched rate), `manual` (entered rate or amount charged)
- Frankfurter (`api.frankfurter.dev/v1`) rounds to 5 decimal places, so rates below 1 are fetched inverted and flipped. It's only used to pre-fill rates — never required
- BigInt literals (`10n`) aren't allowed with the ES2017 target — use `BigInt(10)`
- Members can't leave a group while on a trip in it that isn't `settled`, and can't delete their account while on any unsettled trip (`getUnsettledTrips` in `src/lib/trip-data.ts`)
- Trip tables (`trip_members`, `expenses.paid_by`, `expense_participants`, `trip_settlements`) use `ON DELETE RESTRICT` to `users` — never hard-delete a user with trip history (`hasTripHistory`); the account deletion route anonymises them so settled trips stay intact
- Settling: `open` → `settling` (creates `suggested` payments via `suggestSettlements`, locks expenses, rates and members) → `settled` once every payment is marked `paid`. With no balances to settle it goes straight to `settled`
- Paid settlements count towards balances — always pass them to `computeTripBalances`, or settled trips show non-zero balances
- Reopening deletes `suggested` payments but keeps `paid` ones; it's blocked if a trip member has left the group

### Environment Variables (Vercel)
- `DATABASE_URL` — Neon connection string (careful with copy-paste — terminal formatting can corrupt it)
- `STRAVA_CLIENT_ID` — 211309
- `STRAVA_CLIENT_SECRET` — set in Vercel
- `AUTH_SECRET` — set in Vercel
- Local env in `.env.local` (gitignored). `.env.local` and `.env` point at the Neon cloud database — don't run migrations or test data against them

### Local Database
- `docker compose up -d` runs Postgres 17 plus a Neon-compatible HTTP proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`) on port 4444
- `.env.development.local` (gitignored, read by `next dev` ahead of `.env.local`) sets `DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main`
- `src/db/index.ts` routes the HTTP driver to `http://db.localtest.me:4444/sql` when the host is `db.localtest.me`; other hosts are unaffected
- Migrations connect directly (drizzle-kit can't use the proxy; it uses the `pg` dev dependency): `DATABASE_URL=postgres://postgres:postgres@localhost:5433/main npm run db:migrate`
- Postgres is on host port 5433 (5432 is often taken by other projects' containers)
- `db.localtest.me` needs working DNS; offline, add `127.0.0.1 db.localtest.me` to `/etc/hosts`
- `db.batch` through the proxy is transactional (rolls back on failure, later statements see earlier writes), matching Neon

## Database

Schema defined in `src/db/schema.ts`:
- `users` — Strava profile + OAuth tokens. Deleting an account with trip history, or that created a group (`groups.created_by` has no delete action), anonymises the row (name "Deleted user", no avatar/Strava id/tokens, `deleted_at` set) instead of deleting it
- `groups` — name, invite code, creator
- `group_members` — composite PK (group_id, user_id)
- `rides` — belongs to group, date, auto_detected flag
- `ride_riders` — composite PK (ride_id, user_id), optional strava_activity_id
- `strava_activities` — stored Strava activities used for ride matching
- `payments` — amount in pence, paid_by, belongs to ride
- `trips` — belongs to group, name, optional dates, base currency, status (open/settling/settled)
- `trip_members` — composite PK (trip_id, user_id), must be group members
- `trip_rates` — composite PK (trip_id, currency), agreed exchange rate to the trip base currency
- `expenses` — belongs to trip, description, date, paid_by, amount + currency, rate, rate_source, base_amount
- `expense_participants` — composite PK (expense_id, user_id)
- `trip_settlements` — belongs to trip, from/to user, amount (base currency), status (suggested/paid), paid_at

Migrations managed via Drizzle Kit:
- `npm run db:generate` — generate migration from schema changes
- `npm run db:push` — push schema directly to DB (dev)
- `npm run db:migrate` — run migrations
- `npm run db:studio` — open Drizzle Studio

## Epic Progress

- [x] Epic 0: Project Setup & Infrastructure
- [x] Epic 1: Strava Authentication
- [x] Epic 2: Group Management
- [x] Epic 3: Manual Rides & Payments
- [x] Epic 4: Balances & Activity Feed
- [x] Epic 5: Strava Ride Detection
- [ ] Epic 6: PWA & Offline Support
- [ ] Epic 7: Group Trips — phases 1–3 (foundations, multi-currency, settle) built; phase 4 (polish) to do

## Conventions

- All amounts stored as **integer minor units** — pence for rides (displayed in GBP £); trips use their base currency via `formatMoney` in `src/lib/money.ts`
- Parse user-entered amounts with `toMinor` (string-based) rather than `parseFloat(x) * 100`
- UUIDs for all primary keys
- Timestamps with timezone
- Mobile-first design, max-width `max-w-lg` for content
- Orange (#f97316) as primary brand colour
- Strava brand orange (#FC4C02) for the sign-in button
- Server components by default, `"use client"` only when needed
- Server actions for form submissions (sign-in, sign-out)
- Never let expected validation failures throw from a form action — in production Next shows a generic "Application error" page. Throw `ActionError` in the action, wrap it with `withFormErrors` so it returns `{ error }`, and render the form with `ActionForm` (`src/components/action-form.tsx`), which shows the message inline and keeps the user's input (see `trips/actions.ts`)
