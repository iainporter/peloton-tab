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

Epic 5 brings the core differentiator — automatic ride detection. Instead of manually logging every ride, PelotonTab now listens to Strava and figures out who rode together.

### Webhook Pipeline

The foundation is a Strava webhook subscription. Strava sends a POST to `/api/strava/webhook` whenever any registered user records an activity. The GET handler responds to Strava's verification challenge, and the POST handler processes incoming events.

When an `activity:create` event arrives, the handler:
1. Looks up the user by their Strava athlete ID
2. Refreshes their access token if needed
3. Fetches the full activity details from the Strava API
4. Filters for ride-type activities only
5. Stores the activity (start time, location, elapsed time) in a new `strava_activities` table

### Matching Algorithm

The matching algorithm checks the incoming activity against recent activities from other members of the user's groups. Two activities are considered a match when:
- Start times are within **30 minutes** of each other
- Start locations are within **1km** (haversine distance)

If either activity is missing GPS data, the algorithm falls back to time-only matching. When matches are found, the algorithm either adds the rider to an existing auto-detected ride for that date/group, or creates a new one.

### Auto-Detected Ride UX

Auto-detected rides appear in the group activity feed with an orange "Strava" badge. They behave exactly like manual rides — users can edit participants, add payments, and delete them. The `auto_detected` flag and `strava_activity_id` on each rider entry provide the link back to Strava.

### Backfill on Group Join

When a user joins a group, the app fetches their last 7 days of Strava activities and runs the matching algorithm. This means if two friends have been riding together before creating a PelotonTab group, those rides get picked up automatically.

### Manual Sync Fallback

Strava webhooks aren't instant — delays of 5–30 minutes are common, and longer during peak times. Rather than making users wait, a "Sync Strava" button on the group detail page lets riders manually trigger a sync. It calls the same backfill function used on group join — fetching the last 7 days of activities from the Strava API and running the matching algorithm. The button sits next to "Log a ride" in the Activity section header, with a loading state while the sync runs.

### What Worked Well

The schema was already well-prepared — `auto_detected` on rides and `strava_activity_id` on ride_riders were there from Epic 0. The new `strava_activities` table stores just enough data for matching without duplicating Strava's full activity model. The fire-and-forget pattern for backfill on join keeps the UX snappy while the matching runs in the background.

---

## Phase 8: PWA & Offline Support (Epic 6)

The final epic turns PelotonTab from a website into something that feels like a native app on your phone.

### Service Worker & Caching Strategy

The service worker (built with Serwist) uses a layered caching strategy:

- **CacheFirst** for Strava avatar images — cached for 7 days with a 100-entry limit. Avatars rarely change, so serving from cache keeps the app feeling instant.
- **CacheFirst** for Next.js static assets (`/_next/static/`) — immutable bundles that are safe to cache permanently.
- **NetworkFirst** for HTML pages, RSC payloads, and API responses — always try for fresh data, but fall back to cached versions when offline.
- **StaleWhileRevalidate** for fonts, images, and CSS — serve cached versions immediately while updating in the background.

The pre-cache manifest (`self.__SW_MANIFEST`) ensures critical assets are available from first install.

### Offline Indicator

A client component listens to the browser's `online`/`offline` events and displays an amber banner — "You're offline — showing cached data" — that slides in and out with a CSS transition. It sits at the top of the app shell so it's visible on every page without being intrusive.

### Offline Payment Queuing

The most interesting offline feature: users can log a payment even without a connection. The system uses IndexedDB (via a lightweight `offline-queue.ts` module) to store pending payments locally.

When the user comes back online, a `PaymentSync` component detects the reconnection, reads all pending payments from IndexedDB, and POSTs them to `/api/payments/sync` in a single batch. Successfully synced payments are removed from the local store and the page refreshes to show the updated data.

Pending payments are displayed inline on the ride detail page with a visual "pending" state so users know what hasn't synced yet.

### Install Experience

The web app manifest includes properly sized icons (192px and 512px), a theme colour matching the brand orange, and standalone display mode. On iOS Safari and Android Chrome, the app installs to the home screen and launches without browser chrome — no address bar, no navigation buttons. The `apple-web-app-capable` meta tag and `black-translucent` status bar style give it a native feel on iPhones.

A `preconnect` hint to Strava's CDN (`dgalywyr863hv.cloudfront.net`) shaves time off avatar loads on first visit.

### What Was Built

- **Service worker** with tiered caching — avatars, static assets, pages, and API data each cached optimally
- **Offline fallback page** — shown when navigating to an uncached page without a connection
- **Offline indicator** — amber banner that appears/disappears based on connectivity
- **Offline payment queue** — IndexedDB-backed queue with automatic sync on reconnection
- **PWA manifest** — installable on iOS and Android with standalone display mode

---

## Phase 9: Strava API Compliance (The Speed Bump)

### The Sandbox Wall

The app was built and deployed in under three hours. Then reality hit: Strava's API starts every app in "sandbox" mode, limited to a single connected athlete — the developer. To let anyone else sign in, you need to submit your app for review, which takes 7–10 business days.

This is a sharp contrast to the build velocity. You can go from zero to a fully functional, deployed app in an afternoon, and then wait two weeks for permission to let a second user try it.

### The Submission Process

Strava's developer application form requires several fields that a freshly built side project doesn't naturally have:

- **Company name** — even for a personal project
- **Support URL** — a public page where athletes can get help
- **Application description** — a detailed explanation of what data you access and why
- **Privacy policy** — covering data collection, retention, and deletion rights

The description needed to go beyond "it tracks coffee expenses". Strava reviewers want to know exactly which API scopes you use, what data you store, and how users can revoke access or delete their data.

### Compliance Audit

Before submitting, we audited the app against both the [Strava API Agreement](https://www.strava.com/legal/api) and the [Strava Brand Guidelines](https://developers.strava.com/guidelines/). Several gaps emerged:

**Branding violations:**
- The sign-in button used a custom-styled `<button>` with a hand-drawn Strava logo SVG. The guidelines require using the official "Connect with Strava" button asset
- "Powered by Strava" attribution was missing entirely. The guidelines require the official logo, not custom text
- The brand colour was `#FC4C02` instead of the correct `#FC5200`
- "View on Strava" links must use bold weight, underline, or the official orange — not a Tailwind approximation

**Missing compliance features:**
- No privacy policy page
- No support page
- No way for users to disconnect their Strava account (revoke the OAuth token on Strava's side)
- No way to delete an account and all associated data
- No "Powered by Strava" attribution anywhere in the app
- No links back to the user's Strava profile
- No contact information for support

### What We Added

**Official Strava assets.** Downloaded the official button and logo assets from Strava's developer site. Replaced the custom sign-in button with the official "Connect with Strava" SVG. Replaced the hand-rolled "Powered by Strava" text with the official horizontal logo. Both appear on the landing page and in a new footer visible on every authenticated page.

**Privacy policy** (`/privacy`). Covers what data we collect (name, photo, activity metadata), how it's used (ride matching within groups), storage and security, user rights (access, disconnect, delete), and data retention.

**Support page** (`/support`). Contact email plus FAQs covering how the app works, how to disconnect Strava, and how to delete your account.

**Strava deauthorization.** A "Disconnect Strava" button on the profile page calls Strava's `POST /oauth/deauthorize` endpoint with the user's access token, then signs them out. This properly revokes PelotonTab's access on Strava's side rather than just clearing the local session.

**Account deletion.** A "Delete Account" button that deauthorizes on Strava, then deletes all user data from the database — strava activities, payments, ride participation, group memberships, and the user record itself.

**"View on Strava" links.** The profile page links to the user's Strava athlete profile. Auto-detected rides link to the user's specific Strava activity. All links use bold text in Strava orange `#FC5200` as required by the brand guidelines.

### The Irony

The compliance work took about an hour — a fraction of the original build time. But it's the kind of work that's easy to overlook when you're moving fast. The Strava API agreement is a 15-page legal document, and the brand guidelines specify exact hex colours and required asset files. None of this is complex, but you won't pass review without it.

The sandbox limitation is actually a reasonable gate. It forces developers to implement proper data handling, user consent, and branding compliance before real users are affected. But it does mean your "ship in three hours" story has an asterisk: *plus 7–10 business days for API approval*.

---

## Conclusion

PelotonTab went from a blank PRD to a deployed, installable PWA in seven epics — the entire journey taking under three hours. Then it spent another hour on Strava API compliance before hitting the review queue. The final product lets cycling groups track shared expenses with almost no friction — sign in with Strava, create a group, share a code, and the app handles the rest.

### What Went Well

**The epic structure paid off.** Breaking the project into small, self-contained phases meant each one could be completed in a single focused session. Manual rides and payments (Epic 3) shipped a usable app before Strava auto-detection (Epic 5) added the magic — if the Strava integration had been blocked, there was still a working product.

**Server actions kept things simple.** No REST API layer, no client-side state management, no fetch calls for mutations. Forms submit to server actions, actions hit the database, `revalidatePath` refreshes the page. The entire app has zero client-side data fetching libraries.

**Schema-first design worked.** Defining all six tables in Epic 0 — including the `auto_detected` flag and `strava_activity_id` — meant later epics never had to migrate existing data. The cascade delete rules set up in the schema saved code in every delete action.

### What Was Harder Than Expected

**Strava OAuth** was the single biggest time sink. Between the non-standard token response, the `client_secret_post` auth method, and the corrupted environment variable on Vercel, Epic 1 took longer than Epics 2, 3, and 4 combined. The lesson: budget extra time for any third-party OAuth integration, and add a debug endpoint before you need one.

**Neon driver versioning** was a quiet trap. The v0.10 → v1.0 breaking change in `@neondatabase/serverless` wasn't well documented, and the error messages didn't point to the version mismatch. Pinning the dependency early avoided pain later.

**Strava API approval** was the surprise bottleneck. Building the app took three hours; getting permission to let a second user sign in takes 7–10 business days. The compliance work itself was straightforward once we knew what was required — official brand assets, privacy policy, account deletion, Strava deauthorization — but it's the kind of thing you only discover at the finish line.

### By the Numbers

- **Under 3 hours** from initial idea to deployed production app — including writing the PRD, planning the epics, and implementing all seven
- **~1 hour** additional for Strava API compliance (branding, privacy policy, account management)
- **7–10 business days** waiting for Strava API review approval
- **7 epics** over the course of the build, plus a compliance phase
- **6 database tables** defined upfront, no schema changes needed after Epic 0
- **0 client-side data fetching libraries** — server components and server actions throughout
- **1 external API integration** (Strava) handling OAuth, activity fetch, and webhooks
- **~30 routes** including pages, API endpoints, and server actions

### AI-Assisted Development

The entire project was built using Claude Code as an AI pair programmer. The approach that worked best: describe the intent clearly, let Claude generate the implementation, then review and test. The debugging sessions — particularly the Strava OAuth and Neon driver issues — were genuinely collaborative, with Claude suggesting hypotheses and debug strategies while the developer verified them against the live environment.

The biggest advantage wasn't speed — it was maintaining momentum. When a debugging session would normally have meant stepping away to search docs and Stack Overflow, having Claude in the loop meant the conversation stayed focused and hypotheses were tested immediately. The biggest limitation was anything requiring visual judgement or real-device testing — PWA install flows, share sheet behaviour, and mobile layout tweaks still needed a human eye on a real phone.

The compliance phase was a good example of AI-assisted thoroughness. Claude fetched the Strava API agreement, audited every page of the app against it, identified seven compliance gaps, and implemented the fixes — official brand assets, privacy policy, support page, deauthorization flow, account deletion — in a single session. The kind of systematic audit that's tedious for a human but well-suited to an AI that can hold the full legal document and the full codebase in context simultaneously.
