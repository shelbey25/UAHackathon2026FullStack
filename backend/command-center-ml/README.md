# command-center-ml

FastAPI ML service for SentinelSupply — linear regression depletion forecasting.

## Tech Stack

- Python 3.11
- FastAPI + Uvicorn
- NumPy (linear regression)
- Pandas
- scikit-learn
- Pydantic (request validation)

## Setup

```bash
cd command-center-ml
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/depletion` | Linear depletion forecast for sector/resource |

## POST /depletion

Receives inventory time-series records, segments them at snap events and restocks, runs linear regression on each segment, and returns the weighted-average depletion slope (units/hour).

**Request:**
```json
{
  "sector": "Wakanda",
  "resource": "Vibranium",
  "records": [
    {
      "timestamp": "2025-03-01T00:00:00Z",
      "stock_level": 500.0,
      "snap_event_detected": false,
      "restock_amount": 0
    }
  ]
}
```

**Response:**
```json
{
  "sector": "Wakanda",
  "resource": "Vibranium",
  "slope": -3.82
}
```

**Requirements:** Minimum 5 records; segments need at least 3 points for regression.

## Project Structure

```
app/
├── __init__.py
├── main.py         # FastAPI app, endpoints, schemas
└── depletion.py    # Segmented linear regression algorithm
```
