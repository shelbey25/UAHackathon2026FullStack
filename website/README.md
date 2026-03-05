# SentinelSupply Command Center — Website

## Overview

SentinelSupply is a centralized Command & Control dashboard that fuses historical inventory data with live field intelligence to forecast resource depletion while securely protecting sensitive identities.  

It is designed to meet the INNOVATE 2026 challenge: aggregating multi-source data, processing unstructured intelligence, forecasting shortages, and delivering actionable operational visibility.

---

# Architecture

```
Next.js Client (:3000) → Express API (:4000) → PostgreSQL (Prisma)
                                              → FastAPI ML (:8000)
                                              → N8N Webhook (LLM report parsing)
```

## Services

1. **command-center-client** — Next.js 16 frontend dashboard
2. **command-center-api** — Express + Prisma + PostgreSQL API gateway
3. **command-center-ml** — FastAPI depletion forecasting service

---

# Tech Stack

## Frontend
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Recharts (charts)
- GSAP 3 (animations)
- Clerk (authentication)

## API Gateway
- Node.js 20
- Express 4
- Prisma ORM
- PostgreSQL
- Helmet / CORS / Rate Limit

## ML Service
- Python 3.11
- FastAPI
- NumPy (linear regression)
- Pandas

## Automation
- N8N workflow (LLM-powered field report parsing via OpenAI)

## Database
- PostgreSQL (Docker local / Railway production)

## DevOps
- Docker Compose
- npm
- Python venv

---

# System Components

## 1. Dashboard
- Interactive Earth map with sector pins (color-coded by depletion risk)
- Inventory depletion charts
- Reports table with filtering and processing
- Hero assignment management
- Jarvis AI sync panel
- Lockdown overlay (triggered on 403)

## 2. Intelligence Processing
- Upload raw field reports
- PII redaction via middleware
- N8N + LLM extraction (resource, location, status)
- Structured report storage

## 3. Forecast Engine
- Segmented linear regression depletion prediction
- Weighted-average slope calculation
- Per-resource depletion rate tracking

## 4. Simulation Engine
- Tick-based stock simulation (25 records per tick)
- Hero assignment with timed durations

---

# Database Schema (Prisma)

```prisma
enum Role {
  VIEWER
  ADMIN
}

enum Priority {
  AVENGERS_LEVEL_THREAT
  HIGH
  ROUTINE
}

model User {
  id    String @id
  email String @unique
  phone String
  name  String
  role  Role   @default(VIEWER)
}

model InventoryRecord {
  id                  Int      @id @default(autoincrement())
  sector_id           String
  resource_type       String
  timestamp           DateTime
  stock_level         Float
  usage_rate_hourly   Float    @default(0)
  snap_event_detected Boolean  @default(false)
  restock_amount      Float    @default(0.0)
  restock_reason      String   @default("")
}

model RawReport {
  id              Int              @id @default(autoincrement())
  report_id       String           @unique
  heroAlias       String?
  secure_contact  String?
  receivedAt      DateTime
  rawText         String
  priority        Priority         @default(ROUTINE)
  ProcessedReport ProcessedReport?
}

model ProcessedReport {
  id             Int      @id @default(autoincrement())
  reportId       Int      @unique
  redactedText   String
  timestamp      DateTime
  resource_name  String
  resource_level String   @default("")
  location       String
  priority       Priority
  cleared        Boolean  @default(false)
  processedAt    DateTime @default(now())
  report         RawReport @relation(fields: [reportId], references: [id])
}

model Resource {
  id            Int      @id @default(autoincrement())
  location      String
  resource      String
  depletionRate Float    @default(0.0)
  lastUpdated   DateTime @default(now())
}

model Hero {
  id                    Int      @id @default(autoincrement())
  hero_name             String   @unique
  is_active             Boolean  @default(false)
  active_resource       String   @default("")
  active_location       String   @default("")
  assignment_start_time DateTime @default(now())
  assignment_end_time   DateTime @default(now())
}
```

---

# Express Middleware Stack

1. Helmet (security headers)
2. CORS
3. JSON body limit (2MB)
4. Rate limit (300 req / 15 min)
5. Clerk auth
6. Role guard (Admin)
7. PII redaction

---

# API Routes

## Health
GET `/health`

## Inventory
GET `/api/inventory?sector=&resource=&days=`

## Reports
GET `/api/reports?page=&limit=&priority=&cleared=`  
POST `/api/reports/upload`  
POST `/api/reports/:report_id/process`  
POST `/api/reports/:report_id/archive`

## Forecast
POST `/api/forecast` (API-key auth)  
GET `/api/forecast/get-all-resources-tracked` (API-key auth)

## Forecasting (Frontend)
GET `/api/forecasting-front-end`

## Heroes
GET `/api/hero?active=`  
GET `/api/hero/:hero_name`  
POST `/api/hero/assign` (API-key auth)  
POST `/api/hero/unassign` (API-key auth)

## Users
GET `/api/users/me?email=`  
POST `/api/users/create`

## Jarvis
POST `/api/jarvis/sync` (API-key auth)

## Simulation
POST `/api/simulate/tick` (API-key auth)

---

# ML Service Endpoint

POST `/depletion`

Input:
```json
{
  "sector": "Wakanda",
  "resource": "Vibranium",
  "records": [
    { "timestamp": "2025-03-01T00:00:00Z", "stock_level": 500.0, "snap_event_detected": false, "restock_amount": 0 }
  ]
}
```

Output:
```json
{ "sector": "Wakanda", "resource": "Vibranium", "slope": -3.82 }
```

---

# Folder Structures

## command-center-client

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── dashboard/page.tsx
├── components/
│   ├── AssignHeroModal.tsx
│   ├── EarthMap.tsx
│   ├── HeroTable.tsx
│   ├── InventoryChart.tsx
│   ├── InventoryTable.tsx
│   ├── JarvisPanel.tsx
│   ├── LockdownOverlay.tsx
│   ├── ReportsTable.tsx
│   └── SubmitReportModal.tsx
├── hooks/
│   ├── useForecast.ts
│   ├── useHeroes.ts
│   ├── useInventory.ts
│   ├── useJarvisSync.ts
│   ├── useLockdown.tsx
│   ├── useReports.ts
│   └── useSyncUser.ts
├── lib/api.ts
└── middleware.ts
```

## command-center-api

```
src/
├── index.js
├── middleware/
│   ├── auth.js
│   ├── redact.js
│   ├── roleGuard.js
│   └── index.js
├── prisma/
│   ├── client.js
│   └── seed.js
└── routes/
    ├── forecast.js
    ├── forecasting-front-end.js
    ├── hero.js
    ├── inventory.js
    ├── jarvis.js
    ├── reports.js
    ├── simulate.js
    └── users.js
```

## command-center-ml

```
app/
├── __init__.py
├── main.py
└── depletion.py
```

---

# Local Setup

## Prereqs
- Node 20
- Python 3.11
- Docker

## Start DB
```bash
docker run -d --name sentinel-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sentinelsupply \
  postgres:16
```

## API
```bash
cd command-center-api
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## ML
```bash
cd command-center-ml
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Client
```bash
cd command-center-client
npm install
npm run dev
```

---

# Data Import

CSV → InventoryRecord  
JSON → RawReport  

Use Prisma seed script.

---

# Demo Flow

1. Login
2. Select sector
3. View depletion chart
4. Click field report
5. Process report
6. Show redacted text + extracted insights
7. Risk level updates

---

# Security

- Clerk auth
- Role middleware
- Rate limiting
- PII redaction before storage
- API gateway boundary
- ML service private

---

# Judging Alignment

Architecture ✔  
Intelligent Processing ✔  
Security ✔  
UI ✔  

---

# 24‑Hour Build Plan

0‑2h: repos, DB, schema  
2‑8h: dashboard UI  
8‑14h: API + Prisma  
14‑18h: FastAPI NLP  
18‑22h: integration + styling  
22‑24h: demo polish  

---

# Team Roles

Frontend: dashboard  
Backend: API + Prisma  
ML: FastAPI  

---

# Presentation Checklist

- Show architecture diagram
- Show raw → redacted transformation
- Show forecast chart
- Show risk update
- Explain security boundary

---

# Summary

SentinelSupply demonstrates a secure enterprise command center capable of transforming messy intelligence into actionable operational forecasts — aligning with CGI’s focus on workflow modernization, analytics, and decision support.
