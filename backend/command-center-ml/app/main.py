"""
SentinelSupply ML Service
FastAPI + regex NLP + linear regression forecast
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import os

from app.depletion import train_and_predict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SentinelSupply ML Service",
    description="NLP extraction, PII redaction, and depletion forecasting",
    version="1.0.0",
)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:4000,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class TextInput(BaseModel):
    text: str
    resource: Optional[str] = None
    sector: Optional[str] = None


class InventoryRecord(BaseModel):
    timestamp: str
    stock_level: float
    snap_event_detected: Optional[bool] = False
    restock_amount: Optional[float] = 0


class DepletionInput(BaseModel):
    sector: str
    resource: str
    records: list[InventoryRecord]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/depletion")
def depletion(body: DepletionInput):
    """
    Receive inventory records over HTTP, train a linear regression model
    on the fly, and predict when stock reaches 0.

    Body: { sector, resource, records: [{timestamp, stock_level}, ...] }
    """
    if len(body.records) < 5:
        raise HTTPException(status_code=422, detail="Need at least 5 records to forecast")

    records = [r.model_dump() for r in body.records]
    result = train_and_predict(records, sector=body.sector, resource=body.resource)
    return result
