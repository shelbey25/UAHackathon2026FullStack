# command-center-client

Next.js web dashboard for the SentinelSupply Command Center.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Recharts (charts)
- GSAP 3 (animations)
- Clerk authentication (`@clerk/nextjs`)
- TypeScript

## Setup

```bash
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Run dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with Clerk sign-in + tech stack presentation |
| `/dashboard` | Main dashboard with tabs: Overview, Graph, Reports, Heroes |

## Dashboard Features

- **Overview tab** — Interactive Earth map with sector pins (color-coded by depletion risk), drill-down to per-resource detail cards
- **Graph tab** — Inventory depletion charts (Recharts) filterable by sector, resource, and time range
- **Reports tab** — Paginated reports table with priority/location/resource/hero/level filters, report processing, archive toggle, and report submission modal
- **Heroes tab** — Hero assignment table with assign/unassign modals
- **Jarvis Panel** — AI sync panel for triggering Jarvis webhook
- **Lockdown Overlay** — Full-screen lockdown mode triggered on 403 responses

## Hooks (Data Layer)

| Hook | API Endpoint | Behavior |
|---|---|---|
| `useInventory` | `GET /api/inventory` | 5s polling; filtered by sector/resource/days |
| `useReports` | `GET /api/reports` | 5s polling; paginated with priority/cleared filters |
| `useForecast` | `GET /api/forecasting-front-end` | 5s polling; all resources with depletion rates |
| `useHeroes` | `GET /api/hero` | Polling with exponential backoff (5s–30s); assign/unassign |
| `useJarvisSync` | `POST /api/jarvis/sync` | On-demand; sends API key |
| `useSyncUser` | `POST /api/users/create` | Runs once on mount; registers Clerk user |
| `useLockdown` | — | React context; toggles lockdown overlay on 403 |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (Clerk + Lockdown providers)
│   ├── page.tsx                # Landing / login page
│   ├── globals.css             # Global styles
│   └── dashboard/
│       └── page.tsx            # Main dashboard page
├── components/
│   ├── AssignHeroModal.tsx     # Hero assignment form modal
│   ├── EarthMap.tsx            # Interactive sector map with drill-down
│   ├── HeroTable.tsx           # Hero list + status table
│   ├── InventoryChart.tsx      # Recharts depletion chart
│   ├── InventoryTable.tsx      # Raw inventory data table
│   ├── JarvisPanel.tsx         # Jarvis AI sync trigger
│   ├── LockdownOverlay.tsx     # Full-screen lockdown mode
│   ├── ReportsTable.tsx        # Paginated reports with filters
│   └── SubmitReportModal.tsx   # New report submission form
├── hooks/
│   ├── useForecast.ts
│   ├── useHeroes.ts
│   ├── useInventory.ts
│   ├── useJarvisSync.ts
│   ├── useLockdown.tsx
│   ├── useReports.ts
│   └── useSyncUser.ts
├── lib/
│   └── api.ts                  # API base URL config
└── middleware.ts               # Clerk route protection
```
