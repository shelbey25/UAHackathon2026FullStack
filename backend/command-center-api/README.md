# command-center-api

Express + Prisma + PostgreSQL API gateway for SentinelSupply.

## Setup

```bash
npm install
```

Copy `.env` (already pre-filled for local Docker Postgres):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sentinelsupply"
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

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/sectors | Unique sector list |
| GET | /api/inventory | Historical records (filter: sector, resource, days) |
| GET | /api/kpis | Stock KPIs per resource (filter: sector) |
| GET | /api/reports | Field intel reports (filter: sector) |
| POST | /api/reports/:id/process | Redact PII + ML extraction |
| GET | /api/forecast | Linear depletion forecast |
