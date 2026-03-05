# SentinelSupply — Backend Services

This directory contains both backend services for the SentinelSupply Command Center.

## Services

| Service | Directory | Port | Description |
|---|---|---|---|
| API Gateway | `command-center-api/` | 4000 | Express + Prisma + PostgreSQL — REST API, auth, PII redaction |
| ML Service | `command-center-ml/` | 8000 | FastAPI — linear regression depletion forecasting |

## Quick Start

### 1. Start PostgreSQL
```bash
docker run -d --name sentinel-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sentinelsupply \
  postgres:16
```

### 2. API Gateway
```bash
cd command-center-api
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### 3. ML Service
```bash
cd command-center-ml
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Architecture

```
Client (Web / iOS)
       │
       ▼
  Express API (:4000)
   ├── PostgreSQL (Prisma ORM)
   ├── FastAPI ML (:8000) — depletion forecasting
   └── N8N Webhook — LLM-powered report parsing
```

See the individual service READMEs for detailed endpoint documentation.
