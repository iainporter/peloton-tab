# PelotonTab

A PWA for tracking shared expenses on group cycling rides. Riders sign in with Strava, form groups, and the app automatically detects who rode together. When someone pays at the coffee stop, the cost is split across all riders present.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **PostgreSQL** on [Neon](https://neon.tech) (serverless)
- **Drizzle ORM**
- **NextAuth.js v5** with Strava OAuth
- **Serwist** for PWA / offline support
- **Vercel** for hosting

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Strava API application](https://www.strava.com/settings/api)

### Setup

```bash
git clone git@github.com:iainporter/peloton-tab.git
cd peloton-tab
npm install
```

Create a `.env.local` file:

```
DATABASE_URL=your-neon-connection-string
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
AUTH_SECRET=your-random-secret
```

Push the database schema:

```bash
npm run db:push
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema directly to DB |
| `npm run db:studio` | Open Drizzle Studio |

## How It Works

1. **Sign in with Strava** — authenticate with your Strava account
2. **Create or join a group** — share an invite code with your riding friends
3. **Ride together** — the app detects shared rides via Strava activity matching
4. **Log payments** — record who paid at the coffee stop
5. **Track balances** — see a running balance of who owes what

All amounts are stored in pence and displayed in GBP (£).

## License

Private project.
