# command-center-ml

FastAPI ML service for SentinelSupply — NLP extraction, PII redaction, and depletion forecasting.

## Setup

```bash
cd command-center-ml
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /redact | Redact PII from text |
| POST | /extract | Extract entities & urgency from text |
| POST | /forecast | Linear depletion forecast for sector/resource |

## POST /extract — example

```json
{
  "text": "Urgent: Wakanda is critically low on Vibranium."
}
```

Response:
```json
{
  "redacted_text": "Urgent: [REDACTED-ORG] is critically low on Vibranium.",
  "entities": [{"text": "Wakanda", "label": "GPE"}],
  "resource": "Vibranium",
  "urgency": "critical"
}
```
