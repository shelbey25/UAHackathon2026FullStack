# FullStackUAInnovate

# SentinelSupply Command Center — Full-Stack Hackathon System

## Overview

SentinelSupply is a centralized Command & Control dashboard that fuses historical inventory data with live field intelligence to forecast resource depletion while securely protecting sensitive identities.  

It is designed to meet the INNOVATE 2026 challenge: aggregating multi‑source data, processing unstructured intelligence, forecasting shortages, and delivering actionable operational visibility.

---

# Architecture

Client → Express API Gateway → (Postgres via Prisma)  
Client → Express → FastAPI ML Service → Express → DB → Response  

## Repos

1. **command-center-client** — Next.js frontend  
2. **command-center-api** — Express + Prisma + Postgres  
3. **command-center-ml** — FastAPI NLP/forecast service  

---

# Tech Stack

## Frontend
- Next.js 14 (App Router)
- React
- Tailwind CSS
- Recharts (charts)
- Clerk (auth)

## API Gateway
- Node.js
- Express
- Prisma ORM
- PostgreSQL
- Helmet / CORS / Rate Limit

## ML Service
- Python
- FastAPI
- spaCy (NER)
- Pandas / NumPy

## Database
- PostgreSQL (Docker local)

## DevOps
- Docker Compose
- pnpm / npm
- Python venv

---

# System Components

## 1. Dashboard
- Inventory depletion charts
- Sector KPIs
- Alerts
- Risk indicators

## 2. Intelligence Processing
- Upload / view raw reports
- PII redaction
- Entity extraction
- Structured summaries

## 3. Forecast Engine
- Trend‑based depletion prediction
- Risk scoring

---

# Database Schema (Prisma)

```prisma
model User {
  id        String  @id
  email     String
  role      Role
}

model InventoryRecord {
  id         Int      @id @default(autoincrement())
  sector     String
  resource   String
  timestamp  DateTime
  quantity   Float
  anomaly    Boolean  @default(false)
}

model RawReport {
  id         Int      @id @default(autoincrement())
  sector     String
  receivedAt DateTime
  rawText    String
}

model ReportSummary {
  id              Int      @id @default(autoincrement())
  reportId        Int
  redactedText    String
  resource        String?
  urgency         String?
  entitiesJson    Json?
  riskScore       Float?
}
```

---

# Express Middleware Stack

Order matters:

1. Helmet (security headers)
2. CORS
3. JSON body limit
4. Rate limit
5. Clerk auth
6. Role guard
7. Routes

---

# API Routes

## Inventory

GET /api/sectors  
GET /api/kpis?sector=North  
GET /api/inventory?sector=North&resource=Water&days=60  

## Reports

GET /api/reports?sector=North  
POST /api/reports/:id/process  

Flow:
Express fetches raw → sends to FastAPI → stores summary → returns structured result

---

# FastAPI Endpoints

POST /redact  
POST /extract  
POST /forecast  

Input:
```
{text: string}
```

Output:
```
{
  redacted_text,
  entities,
  depletion_date,
  risk_score
}
```

---

# Folder Structures

## command-center-client

```
app/
components/
lib/api.ts
styles/
```

## command-center-api

```
src/
  middleware/
  routes/
  services/
  prisma/
```

## command-center-ml

```
app/
  main.py
  nlp.py
  forecast.py
```

---

# Local Setup

## Prereqs
- Node 20
- Python 3.11
- Docker

## Start DB
```
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
```

## API
```
cd command-center-api
npm install
npx prisma migrate dev
npm run dev
```

## ML
```
cd command-center-ml
python -m venv venv
pip install fastapi uvicorn spacy pandas
uvicorn main:app --reload
```

## Client
```
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
