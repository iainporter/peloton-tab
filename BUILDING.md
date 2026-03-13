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

### The Smoothest Epic So Far

After the debugging marathon of Epic 1, group management was refreshingly straightforward. The database schema was already in place from Epic 0, so this was purely application logic and UI.

### Server Actions for Everything

Used Next.js server actions for all mutations — create group, join group, and leave group. No API routes needed. Each action validates the session, performs the database operation, and redirects. The pattern is clean and keeps everything colocated in a single `actions.ts` file.

### Invite Codes

Groups get a randomly generated 6-character alphanumeric code using an ambiguity-safe character set (no I/1/O/0 to avoid confusion when sharing verbally). Two ways to join:

1. **Manual entry** — `/groups/join` with a text input
2. **Shareable link** — `/join/[code]` that auto-joins authenticated users

The shareable link route sits outside the `(app)` route group since unauthenticated users might click it. If they're not signed in, they're redirected to the landing page with the join code preserved as a query parameter.

### Web Share API Gotcha

The share button uses `navigator.share()` on mobile for native sharing. Initially passed both `text` and `url` parameters, but this caused WhatsApp (and some other messaging apps) to be excluded from the share sheet on iOS and Android.

Fix: embed the URL directly in the `text` field instead of using a separate `url` parameter. This ensures all messaging apps appear as share targets.

### What Was Built

- **Group list** (`/groups`) — shows all groups the user belongs to with member counts. Empty state with Create/Join buttons
- **Create group** (`/groups/new`) — simple name form, auto-generates invite code, creator becomes first member
- **Join group** (`/groups/join`) — enter a code manually, with validation
- **Join via link** (`/join/[code]`) — one-click join from shared links
- **Group detail** (`/groups/[id]`) — invite code with share button, member list with Strava avatars, placeholder for rides and balances
- **Leave group** — two-step confirmation to prevent accidental departure

---

## Phase 5: Manual Rides & Payments (Epic 3)

### The Core Loop

This is the epic that makes the app actually useful. Everything before it was infrastructure and scaffolding — now users can log who rode together, record who paid for the coffees, and see the per-person split.

### Nested Route Structure

Rides belong to groups, and payments belong to rides, so the routes mirror that hierarchy:

```
/groups/[id]/rides/new              → Log a new ride
/groups/[id]/rides/[rideId]         → Ride detail with payments
/groups/[id]/rides/[rideId]/edit    → Edit who rode
/groups/[id]/rides/[rideId]/payments/new → Add a payment
```

This keeps everything scoped under the group — every page inherits the group ID from the URL and verifies the current user is a member before showing anything.

### Server Actions (Again)

Followed the same pattern established in Epic 2: a single `actions.ts` file with all the ride and payment mutations. Six actions in total — `createRide`, `deleteRide`, `updateRideParticipants`, `addPayment`, `editPayment`, `deletePayment`.

Every action starts with a `requireGroupMember(groupId)` check that validates both authentication and group membership. This is a helper extracted to avoid repeating the same two queries across all six actions.

### Participant Picker

The create ride form shows all group members as checkboxes, all checked by default (since most rides involve everyone). The form uses `name="participants"` with multiple checkbox values, and the server action extracts them with `formData.getAll("participants")`.

This pattern also powers the edit riders page — same checkboxes, but pre-checked based on the current ride participants.

### Money Handling

Amounts are stored in pence (integers) to avoid floating-point issues. The user enters pounds (e.g. "4.50"), the server action multiplies by 100, and the display divides by 100 with `.toFixed(2)`. The `£` symbol is positioned inside the input field using absolute positioning for a clean look.

Per-person share is simply `totalPayments / numberOfRiders` — displayed on the ride detail page in an orange accent colour to make it stand out.

### Cascade Deletes

The schema was designed with `onDelete: "cascade"` on the `ride_riders` and `payments` foreign keys back in Epic 0. This means deleting a ride automatically cleans up all its riders and payments — no manual cleanup needed in the delete action. A small upfront schema decision that paid off here.

### Client Components for Interactivity

Three client components handle the interactive bits:
- **Delete ride button** — two-step confirmation (same pattern as leave group from Epic 2)
- **Delete payment button** — small X icon, immediate deletion
- **Edit payment dialog** — bottom sheet modal for updating amount and note inline

The edit payment component uses a fixed overlay (`fixed inset-0`) with a white card anchored to the bottom — a mobile-friendly pattern that feels native on phones.

### Group Detail Upgrade

The group detail page's "Recent Rides" placeholder was replaced with a live ride list showing the 5 most recent rides ordered by date. Each ride displays its title (or date if untitled), rider count, and total spend. Tapping a ride navigates to its detail page.

### What Was Built

- **Log a ride** — date picker (defaults to today), optional title, participant checkboxes
- **Ride detail** — rider avatars, payment list with payer/amount/note, per-person share calculation
- **Add payment** — pound amount input (converted to pence), optional note, attributed to current user
- **Edit/delete payments** — inline edit modal, delete with single tap
- **Edit riders** — update who participated after the fact
- **Delete ride** — confirmation dialog, cascade-deletes all payments
- **Ride list** — recent rides on group detail page with spend totals

---

## Phase 6: Balances & Activity Feed (Epic 4)

With rides and payments in place, the next natural question is: who owes what? Epic 4 adds the financial visibility layer.

### Balance Calculation Engine

The core logic lives in `src/lib/balances.ts`. For each group member:
- **Credit** = total of all payments they've made across rides in the group
- **Debit** = sum of their per-person share for each ride they participated in (total payments for that ride / number of riders)
- **Balance** = credit minus debit

A positive balance means others owe you; negative means you owe the group. The calculation fetches all rides, payments, and participation data in bulk queries rather than per-member, keeping it efficient.

### Balance Summary on Group Page

The group detail page now shows a **Balances** section prominently. Each member is listed with their net balance — green for positive, red for negative, grey for even. Tapping a member navigates to their payment history.

### Member Payment History

A new page at `/groups/[id]/members/[userId]` provides a detailed breakdown for any group member:
- Net balance with credit/debit split
- Full list of payments they've made (with amounts and notes)
- All rides they've participated in

This makes it transparent exactly why someone's balance is what it is.

### Activity Feed

The "Recent Rides" section has been upgraded to a full **Activity Feed** showing:
- All rides (not just the 5 most recent)
- Who rode on each ride (first names listed)
- Payment breakdown per ride with payer names
- Per-person share calculation

Each entry is a tappable card linking to the ride detail page.

### Group List Balance Preview

The groups list page now shows each group's balance next to the group name. A quick green `+£x.xx` or red `-£x.xx` tells you at a glance where you stand, without needing to tap into the group.

### What Worked Well

This was the most straightforward epic so far — no external APIs, no OAuth quirks, just data aggregation and display. The existing schema from Epic 3 had everything needed. The balance calculation is done in application code rather than complex SQL, which keeps it readable and testable. Building the entire epic took a single pass with no debugging detours.

---

## Phase 7: Strava Ride Detection (Epic 5)

*Coming soon...*

---

## Phase 8: PWA & Offline Support (Epic 6)

*Coming soon...*

---

## Conclusion

*To be written once the app is complete.*
