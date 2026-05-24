# Workflow: n8n Integration

**Layer**: WAT Layer 1 — Workflow (SOP)
**Owner**: JobSearchOps ↔ JobOffersOps
**Purpose**: Define how JobSearchOps hands off captured jobs to n8n for downstream processing

## Architecture

```
JobSearchOps pipeline
        │
        │  POST /webhook/jobsearchops/joboffers
        │  payload: { rows: [...jobs] }
        ▼
  n8n: JOBSEARCHOPS workflow (ID: NHoAIqCkr7ft8LG6)
        │
        │  Expands rows, routes each job
        ▼
  (future) JobOffersOps deep processing
```

## n8n Server

- URL: `http://localhost:5678`
- API key: stored in `.env` as `N8N_API_KEY`
- Admin UI: open `http://localhost:5678` in browser

## JOBSEARCHOPS Workflow

| Property | Value |
|----------|-------|
| Workflow ID | `NHoAIqCkr7ft8LG6` |
| Webhook path | `POST /webhook/jobsearchops/joboffers` |
| Status | Must be **ACTIVE** to receive production payloads |
| Nodes | Webhook → Code (expand rows) → Respond to Webhook |

### Activating the workflow

Via API:
```bash
source .env
curl -X PATCH http://localhost:5678/api/v1/workflows/NHoAIqCkr7ft8LG6 \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

Via UI: open n8n → JOBSEARCHOPS → toggle Active switch.

### Testing the webhook (without running full pipeline)

```bash
source .env
curl -X POST $N8N_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"title": "Test Job", "organization": "Test Co", "apply_url": "https://example.com"}]}'
```

Expected response:
```json
{ "ok": true, "received": 1, "batch_name": "jobsearchops-batch" }
```

## Webhook Modes

| Mode | URL | When to use |
|------|-----|-------------|
| Test | `/webhook-test/jobsearchops/joboffers` | n8n must be in "Listen for test event" |
| Production | `/webhook/jobsearchops/joboffers` | Workflow must be Active |

Switch between modes by commenting/uncommenting `N8N_WEBHOOK_URL` in `.env`.

## Other n8n Workflows

| Name | ID | Status | Purpose |
|------|-----|--------|---------|
| JOBSEARCHOPS | NHoAIqCkr7ft8LG6 | Inactive | Receives job batches from this pipeline |
| OS-ChildAI-DecisionEngine-v1 | KD2Ty4HuAbphI4dj | Inactive | AI decision routing (JobOps-OS level) |
| TODOIST CAPTURE | KNgrM0oEdevRqg4z | Inactive | Task capture |
| 00 - HELLO WORLD | jaLHo6McQYDDCdSW | Inactive | Webhook smoke test |

## Edge Cases

| Situation | Action |
|-----------|--------|
| Webhook returns `{"message":"'X-N8N-API-KEY' header required"}` | You called the API endpoint, not the webhook. Use `/webhook/` not `/api/v1/` |
| Workflow not receiving payloads | Check workflow is Active. If status = inactive, activate via API above |
| n8n not running | Start with `n8n start` or your local launcher |
