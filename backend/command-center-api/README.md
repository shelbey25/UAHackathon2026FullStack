# command-center-api

Express + Prisma + PostgreSQL API gateway for SentinelSupply.

## Tech Stack

- Node.js 20 / Express 4
- Prisma ORM + PostgreSQL
- Clerk authentication (`@clerk/express`)
- Helmet / CORS / Rate Limiting

## Setup

```bash
npm install
```

Copy `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentinelsupply"
CLERK_SECRET_KEY="sk_test_..."
API_KEY="your-api-key"
CLIENT_ORIGIN="http://localhost:3000"
ML_SERVICE_URL="http://localhost:8000"
```

Start Postgres:
```bash
docker run -d --name sentinel-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sentinelsupply postgres:16
```

Run migrations + seed:
```bash
npx prisma migrate dev --name init
npm run db:seed
```

Start dev server:
```bash
npm run dev
```

## Middleware Stack

1. Helmet (security headers)
2. CORS
3. JSON body parsing (2MB limit)
4. Rate limiting (300 req / 15 min)
5. Clerk auth (`requireAuth`)
6. Role guard (`requireAdmin`)
7. PII redaction (`redactMiddleware`)

## Endpoints

### Public / API-Key Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/api/forecast` | API key | Run depletion forecast for sector/resource |
| GET | `/api/forecast/get-all-resources-tracked` | API key | List all tracked resources |
| POST | `/api/hero/assign` | API key | Assign hero to resource/location |
| POST | `/api/hero/unassign` | API key | Unassign hero |
| GET | `/api/hero` | None | List heroes (filter: `?active=true`) |
| GET | `/api/hero/:hero_name` | None | Get specific hero |
| POST | `/api/jarvis/sync` | API key | Sync data to Jarvis webhook |
| POST | `/api/simulate/tick` | API key | Run one simulation tick (25 inventory records) |

### Clerk Auth (No Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me?email=` | Get current user |
| POST | `/api/users/create` | Create/register user |

### Clerk Auth + Admin + PII Redaction

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inventory?sector=&resource=&days=` | Historical inventory records |
| GET | `/api/reports?page=&limit=&priority=&cleared=` | Paginated field reports |
| POST | `/api/reports/upload` | Upload raw report |
| POST | `/api/reports/:report_id/process` | Process report (N8N → structured JSON) |
| POST | `/api/reports/:report_id/archive` | Archive/clear a processed report |
| GET | `/api/forecasting-front-end` | All resources with depletion rates |

## Database Models

- `User` — Clerk-synced users with roles (VIEWER / ADMIN)
- `InventoryRecord` — Time-series stock levels per sector/resource
- `RawReport` — Unprocessed field intelligence with priority
- `ProcessedReport` — LLM-structured report (resource, location, level, cleared status)
- `Resource` — Tracked resources with depletion rates
- `Hero` — Hero assignments to resources/locations

## Project Structure

```
src/
├── index.js              # Express app entry point
├── middleware/
│   ├── auth.js           # Clerk JWT verification
│   ├── redact.js         # PII redaction middleware
│   ├── roleGuard.js      # Admin role enforcement
│   └── index.js          # Middleware barrel export
├── prisma/
│   ├── client.js         # Prisma client singleton
│   └── seed.js           # Database seeding script
└── routes/
    ├── forecast.js       # Depletion forecast (calls ML service)
    ├── forecasting-front-end.js  # Resource tracking for dashboard
    ├── hero.js           # Hero assignment management
    ├── inventory.js      # Inventory record queries
    ├── jarvis.js         # Jarvis webhook sync
    ├── reports.js        # Report CRUD + N8N processing
    ├── simulate.js       # Simulation tick engine
    └── users.js          # User registration/lookup
```
