# PelotonTab - Claude Code Context

## Project Overview

PelotonTab is a PWA that tracks shared expenses during group cycling rides. Riders authenticate via Strava, form groups, and the app automatically detects who rode together. When someone pays for the coffee stop, they log the amount and it's split across all riders present.

- **PRD**: `PRD.md` — full product requirements
- **Epics**: `epics/` — implementation plan broken into 7 epics (0-6)
- **Build Journal**: `BUILDING.md` — article documenting the build process, update as each epic completes

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL on Neon (serverless) via `@neondatabase/serverless` v0.10
- **ORM**: Drizzle ORM (`drizzle-orm/neon-http` adapter)
- **Auth**: NextAuth.js v5 (Auth.js) with custom Strava OAuth provider
- **PWA**: Serwist (`@serwist/turbopack`) — uses SerwistProvider, not webpack plugin
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
      groups/page.tsx       # Placeholder
      rides/page.tsx        # Placeholder
      profile/page.tsx      # User profile + sign out
    api/auth/[...nextauth]/ # NextAuth route handler
  components/
    app-shell.tsx           # Header (logo + user avatar) + bottom nav
    ui.tsx                  # Button, Input, Card, EmptyState
  db/
    schema.ts               # Full Drizzle schema (6 tables)
    index.ts                # DB connection (neon HTTP driver)
  lib/
    auth.ts                 # NextAuth config, JWT callbacks, token refresh
    strava-provider.ts      # Custom Strava OAuth provider
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

### Strava OAuth
- Custom provider in `src/lib/strava-provider.ts`
- Strava's token endpoint returns an `athlete` object embedded in the response — the `conform` handler strips it
- Uses `client_secret_post` auth method (not Basic auth)
- Token refresh is handled in the NextAuth JWT callback and updates the DB
- `AUTH_SECRET` must be passed explicitly in NextAuth config (env auto-detection unreliable on Vercel)
- `trustHost: true` is set for Vercel deployment

### Next.js 16 + Serwist
- Next.js 16 uses Turbopack by default — `@serwist/next` (webpack) doesn't work
- Using `@serwist/turbopack` with `SerwistProvider` client component instead
- Middleware shows a deprecation warning about "proxy" — safe to ignore, still works

### Environment Variables (Vercel)
- `DATABASE_URL` — Neon connection string (careful with copy-paste — terminal formatting can corrupt it)
- `STRAVA_CLIENT_ID` — 211309
- `STRAVA_CLIENT_SECRET` — set in Vercel
- `AUTH_SECRET` — set in Vercel
- Local env in `.env.local` (gitignored)

## Database

Schema defined in `src/db/schema.ts`:
- `users` — Strava profile + OAuth tokens
- `groups` — name, invite code, creator
- `group_members` — composite PK (group_id, user_id)
- `rides` — belongs to group, date, auto_detected flag
- `ride_riders` — composite PK (ride_id, user_id), optional strava_activity_id
- `payments` — amount in pence, paid_by, belongs to ride

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

## Conventions

- All amounts stored in **pence** (integer), displayed in **GBP (£)**
- UUIDs for all primary keys
- Timestamps with timezone
- Mobile-first design, max-width `max-w-lg` for content
- Orange (#f97316) as primary brand colour
- Strava brand orange (#FC4C02) for the sign-in button
- Server components by default, `"use client"` only when needed
- Server actions for form submissions (sign-in, sign-out)
