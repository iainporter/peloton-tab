# Building PelotonTab: From Idea to Production with AI-Assisted Development

## The Idea

Groups of cycling friends take turns paying for coffee and cakes at cafe stops. There's no easy way to track who has paid what over time, leading to informal mental accounting that's often wrong and occasionally awkward.

PelotonTab is a lightweight PWA that integrates with Strava to automatically detect group rides, allows simple expense logging, and maintains a fair running balance for each group member.

## The Approach

This article documents the full journey of building PelotonTab — from writing the PRD through to production deployment — using Claude Code as an AI pair programmer. Every step is captured as it happened, including the wrong turns and debugging sessions.

### Tech Stack

- **Frontend + Backend**: Next.js 16 (TypeScript), deployed as a PWA
- **Database**: PostgreSQL on Neon (serverless)
- **ORM**: Drizzle
- **Auth**: Strava OAuth via NextAuth.js v5
- **PWA**: Serwist (service worker / offline support)
- **Hosting**: Vercel
- **CI/CD**: GitHub auto-deploy via Vercel

---

## Phase 1: Planning

Started with a Product Requirements Document (PRD) that defined the core concepts — groups, rides, payments, and balances — along with the data model, Strava integration details, and a clear scope boundary for V1.

From the PRD, we broke the work into seven epics:

| Epic | Name | Purpose |
|------|------|---------|
| 0 | Project Setup & Infrastructure | Bootstrap Next.js, DB, PWA, deploy pipeline |
| 1 | Strava Authentication | OAuth sign-in, token storage and refresh |
| 2 | Group Management | Create/join groups, invite codes |
| 3 | Manual Rides & Payments | Core expense tracking loop |
| 4 | Balances & Activity Feed | Who owes what, group history |
| 5 | Strava Ride Detection | Auto-detect group rides via webhooks |
| 6 | PWA & Offline Support | Caching, offline queuing, install experience |

A key design decision was putting manual rides and payments (Epic 3) before Strava auto-detection (Epic 5). This gives a usable expense-tracking app early, with Strava detection layering on as an enhancement.

---

## Phase 2: Project Setup (Epic 0)

### Scaffolding

Created the Next.js 16 app with TypeScript, Tailwind CSS, and ESLint. Added Prettier for consistent formatting. Nothing unusual here — standard `create-next-app` with the App Router.

### Database Schema

Set up Drizzle ORM with the full schema from the PRD in one go — six tables covering users, groups, group memberships, rides, ride participants, and payments. Generated the initial migration and pushed it to a Neon serverless Postgres instance.

One early lesson: Drizzle Kit doesn't pick up `.env.local` files automatically. Added `dotenv/config` to the Drizzle config to fix this.

### PWA Configuration

Next.js 16 defaults to Turbopack, but the standard `@serwist/next` package only supports webpack. Switched to `@serwist/turbopack` which provides experimental Turbopack support via a `SerwistProvider` client component rather than a webpack plugin wrapping `next.config.ts`.

The setup involves:
- A service worker file (`src/app/sw.ts`) with precaching and runtime caching
- A client-side provider component that registers the service worker
- A web app manifest for installability
- An offline fallback page

### App Shell

Created a mobile-first layout with a sticky header and bottom navigation bar using a Next.js route group `(app)` to wrap authenticated pages. Built a small set of base UI components (Button, Input, Card, EmptyState) to keep things consistent.

### Deployment

Created the GitHub repo and connected it to Vercel for auto-deploy on push to `main`. The placeholder app was live within minutes.

### App Icon

Generated a simple orange icon (bike wheel + "TAB" text) as an SVG, then used `sharp` to produce PNG variants for the PWA manifest and Strava API app registration.

---

## Phase 3: Strava Authentication (Epic 1)

### The Chicken-and-Egg Problem

Strava requires a website URL and authorization callback domain when registering an API app. But we don't have a domain until we deploy. Solution: deploy the placeholder app to Vercel first, then use the `*.vercel.app` domain for Strava registration.

### Custom OAuth Provider

NextAuth.js v5 (Auth.js) doesn't ship with a Strava provider, so we built a custom one. This turned out to be the most debugging-intensive part of the project so far.

**Problem 1: MissingSecret error on Vercel**
NextAuth v5 renamed the env var from `NEXTAUTH_SECRET` to `AUTH_SECRET`. Even after adding it to Vercel, the error persisted. Fix: pass the secret explicitly in the NextAuth config rather than relying on env var auto-detection.

**Problem 2: Configuration error after Strava consent**
Strava's OAuth token endpoint returns a non-standard response — it embeds the full athlete profile as an `athlete` object alongside the OAuth tokens. NextAuth's token parser doesn't expect this and fails silently, redirecting to `/api/auth/error?error=Configuration`.

Fix: added a `conform` handler on the token endpoint that intercepts the response, strips the `athlete` object, and returns only the standard OAuth fields:

```typescript
token: {
  url: "https://www.strava.com/oauth/token",
  async conform(response: Response) {
    const json = await response.json();
    const { athlete, ...oauthFields } = json;
    return new Response(JSON.stringify(oauthFields), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  },
},
```

Also set `client_secret_post` as the token auth method since Strava sends credentials in the POST body rather than as a Basic auth header.

**Problem 3: Database connection failing on Vercel**
The Neon connection string included `channel_binding=require`, which is a PostgreSQL wire protocol feature. The `@neondatabase/serverless` HTTP driver doesn't use the wire protocol, so this parameter was harmless... or so we thought.

First attempt: stripped `channel_binding` from the URL. Didn't help.
Second attempt: switched to the WebSocket-based `Pool` driver. This doesn't work on Vercel's serverless runtime (no persistent WebSocket).
Third attempt: reverted to the HTTP driver. Still failing.

The breakthrough came from adding a debug API route (`/api/debug`) that tested the database connection directly and returned the masked connection string. The output revealed the real problem:

```
"masked": "postgresql://neondb_owner:***@...neondb │\n  │ _URL     │ ?sslmode=require..."
```

The `DATABASE_URL` environment variable in Vercel had been pasted with terminal formatting characters (box-drawing characters from a table view). The connection string contained `│\n  │ _URL     │` embedded in it. Deleting and re-adding the env var with a clean value fixed the issue.

**Problem 4: Drizzle ORM / Neon driver version mismatch**
`@neondatabase/serverless` v1.x changed the `neon()` function to only accept tagged template literals (`sql\`SELECT ...\``), but `drizzle-orm/neon-http` calls it with positional parameters (`sql("SELECT $1", [value])`). Pinned to v0.10 for compatibility.

### What Worked

Once all the edge cases were resolved:
- Users sign in via Strava OAuth and their profile (name, avatar) is stored in the database
- Strava access and refresh tokens are persisted for future API calls
- Token refresh happens transparently in the JWT callback
- All app routes are protected by middleware — unauthenticated users redirect to the landing page
- The profile page shows the user's Strava avatar and a sign-out button

### Lessons Learned

1. **Always add a debug endpoint early.** The `/api/debug` route that tested the raw database connection was what cracked the env var problem. Without it, we'd have kept chasing driver issues.
2. **Check env var values character by character.** Copy-paste from dashboards can introduce invisible or formatting characters.
3. **Pin driver versions.** Major version bumps in database drivers can break ORM adapters silently.
4. **Non-standard OAuth providers need extra care.** Strava's token response format required custom handling at multiple levels.

---

## Phase 4: Group Management (Epic 2)

*Coming soon...*

---

## Phase 5: Manual Rides & Payments (Epic 3)

*Coming soon...*

---

## Phase 6: Balances & Activity Feed (Epic 4)

*Coming soon...*

---

## Phase 7: Strava Ride Detection (Epic 5)

*Coming soon...*

---

## Phase 8: PWA & Offline Support (Epic 6)

*Coming soon...*

---

## Conclusion

*To be written once the app is complete.*
