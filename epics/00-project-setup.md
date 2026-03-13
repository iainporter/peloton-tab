# Epic 0: Project Setup & Infrastructure

## Goal
Bootstrap the Next.js project with all core tooling, database, and deployment pipeline so subsequent epics have a solid foundation.

## Stories

### 0.1 — Initialise Next.js project
- Create Next.js app with TypeScript, App Router, Tailwind CSS
- Configure ESLint and Prettier
- Add a basic health-check page (`/`) with placeholder content

### 0.2 — Database setup (Neon + Drizzle)
- Provision Neon serverless Postgres database
- Install and configure Drizzle ORM
- Create initial migration with the full schema from the PRD:
  - `users`, `groups`, `group_members`, `rides`, `ride_riders`, `payments`
- Add Drizzle migration scripts to `package.json`

### 0.3 — PWA configuration (Serwist)
- Install and configure Serwist for service worker generation
- Add web app manifest (`manifest.json`) with app name, icons, theme colour
- Verify "Add to Home Screen" works on mobile

### 0.4 — CI/CD & Deployment
- Create GitHub repo
- Connect to Vercel for auto-deploy on push to `main`
- Set up environment variables in Vercel (database URL, Strava credentials)
- Verify successful deployment of the placeholder app

### 0.5 — Shared UI foundation
- Install a lightweight component library or set up base Tailwind components (buttons, cards, inputs, layout shell)
- Create mobile-first app shell layout (header, main content area, bottom nav)

## Acceptance Criteria
- `npm run dev` starts the app locally with DB connection working
- Drizzle migrations run cleanly against Neon
- App deploys to Vercel on push to `main`
- PWA installable on mobile
- App shell renders on all screen sizes

## Dependencies
None — this is the foundation.
