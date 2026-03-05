# SentinelSupply Command Center — Full-Stack System

SentinelSupply is a secure, full-stack command-and-control platform that aggregates resource inventory, processes field intelligence, forecasts shortages, and delivers operational visibility through web and mobile dashboards.

It was built for the UA Innovate hackathon and demonstrates enterprise-grade architecture aligned with CGI-style analytics and workflow modernization systems.

---

# System Overview

SentinelSupply tracks strategic resources (e.g., Vibranium, Arc Reactor Cores, Medical Kits) across multiple global sectors and provides:

- Real-time inventory monitoring  
- AI-processed field intelligence reports  
- Resource depletion forecasting  
- Hero assignment + restocking simulation  
- Secure dashboards (web + iOS)  

The platform consists of four layers:

1. Web dashboard (Next.js)
2. API gateway (Express + Prisma)
3. ML service (FastAPI)
4. Mobile companion (iOS SwiftUI)

---

# Architecture

```
                ┌──────────────────────────────┐
                │       Next.js Web App        │
                └──────────────┬───────────────┘
                               │
                               ▼
                    ┌───────────────────┐
                    │   Express API     │
                    │  (Node + Prisma)  │
                    └───────┬───────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼                               ▼
   ┌─────────────────┐            ┌─────────────────┐
   │ PostgreSQL DB   │            │ FastAPI ML      │
   │ Inventory/Data  │            │ Forecast/NLP    │
   └─────────────────┘            └─────────────────┘

                    │
                    ▼
           ┌─────────────────┐
           │   N8N Workflow   │
           │  (LLM Pipeline)  │
           └─────────────────┘

                    ▲
                    │
            ┌────────────────┐
            │  iOS SwiftUI   │
            │  Companion App │
            └────────────────┘
```

---

# Repositories / Services

| Service | Description |
|---|---|
command-center-client | Next.js frontend dashboard |
command-center-api | Express + Prisma API gateway |
command-center-ml | FastAPI ML service |
command-center-ios | SwiftUI mobile companion |
N8N workflow | LLM-powered field report parsing pipeline |

---

# Tech Stack

## Frontend (Web)
- Next.js 16
- React 19
- Tailwind CSS 4
- Recharts
- GSAP (animations)
- Clerk authentication

## Mobile
- SwiftUI
- Clerk auth
- REST API client

## API Gateway
- Node.js 20
- Express 4
- Prisma ORM
- PostgreSQL
- Helmet / CORS / Rate Limit

## ML Service
- Python 3.11
- FastAPI
- scikit-learn
- Pandas / NumPy

## Automation / AI Pipeline
- N8N workflow automation

## DevOps
- Docker
- Docker Compose
- pnpm / npm
- Python venv

---

# N8N Workflow — Field Report Processing

N8N serves as the automation layer that transforms raw, unstructured field intelligence strings into structured, usable JSON data.

**How it works:**

1. **Webhook Trigger** — The Express API forwards raw field report text to an N8N webhook endpoint via POST.
2. **AI Agent (LLM)** — N8N passes the text to an OpenAI-powered AI Agent that analyzes the message and extracts:
   - **Resource** — Mapped to a known resource (`Vibranium (kg)`, `Arc Reactor Cores`, `Medical Kits`, `Pym Particles`, `Clean Water (L)`, or `Misc`)
   - **Location** — Mapped to a known sector (`Wakanda`, `Avengers Compound`, `New Asgard`, `Sanctum Sanctorum`, `Sokovia`, or `Uncharted`)
   - **Status** — Classified as `NONE`, `CRITICAL`, `LOW`, `MODERATE`, `SUFFICIENT`, or `SURPLUS`
3. **Structured Output Parser** — Enforces a JSON schema on the LLM output to guarantee a consistent response shape.
4. **Webhook Response** — Returns the structured JSON back to the calling service for storage and downstream use.

```
Raw text → N8N Webhook → AI Agent (OpenAI) → Structured JSON → API
```

This pipeline turns messy, misspelled, or informal field messages into clean, categorized data that feeds the dashboards and forecasting engine.

---

# Core Features

## Dashboard
- Inventory depletion charts
- Sector KPIs
- Risk indicators
- Alerts

## Intelligence Processing
- Upload raw reports
- PII redaction
- Entity extraction
- Structured summaries

## Forecast Engine
- Linear regression depletion prediction
- Risk scoring

## Simulation Engine
- Hourly stock changes
- Surge modeling
- Restocking events
- Hero assignments

## Mobile Companion
- Reports browsing
- Dashboard stats
- Report creation
- Profile + auth

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

# API Overview

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

## Hero Assignment
GET `/api/hero?active=` (list heroes)  
GET `/api/hero/:hero_name` (get hero)  
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

# ML Service

POST `/depletion`

Input:
```json
{
  "sector": "Wakanda",
  "resource": "Vibranium",
  "records": [
    { "timestamp": "2025-03-01T00:00:00Z", "stock_level": 500.0, "snap_event_detected": false, "restock_amount": 0 },
    ...
  ]
}
```

Output:
```json
{ "sector": "Wakanda", "resource": "Vibranium", "slope": -3.82 }
```

The ML service splits inventory records into segments at snap events or restocks, computes a linear regression slope for each segment, and returns the weighted average slope. Requires at least 5 records.

---

# Mobile App (iOS)

SwiftUI companion dashboard with Clerk auth.

Setup:
- Open `CommandCenter.xcodeproj`
- Set backend URL in Config.swift
- Run on iOS 17+

---

# Local Development

## Database
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres

## API
cd command-center-api  
npm install  
npx prisma migrate dev  
npm run dev  

## ML
cd command-center-ml  
python -m venv venv  
pip install -r requirements.txt  
uvicorn app.main:app --reload --port 8000  

## Web
cd command-center-client  
npm install  
npm run dev  

---

# Security

- Clerk authentication
- JWT middleware
- Role-based access
- API-key protected automation routes
- PII redaction
- API gateway boundary
- Private ML service

---

# Demo Flow

1. Login
2. Select sector
3. View depletion chart
4. Open field report
5. Process report
6. See structured insights
7. Forecast updates

---

# Summary

SentinelSupply demonstrates a secure enterprise command-center architecture capable of transforming messy field intelligence into actionable operational forecasts across web and mobile interfaces.
