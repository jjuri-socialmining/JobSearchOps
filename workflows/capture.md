# Workflow: Job Capture

**Layer**: WAT Layer 1 — Workflow (SOP)
**Owner**: JobSearchOps
**Trigger**: Manual or scheduled (via JobOps-OS orchestrator)

## Objective

Run the job capture pipeline across all configured sources, apply Level 1 keyword filters, and produce a scored job batch ready for downstream processing by JobOffersOps.

## Required Inputs

| Input | Source | Notes |
|-------|--------|-------|
| Sources list | `config/sources.yaml` | Defines each job board and adapter |
| Keywords | `config/keywords.yaml` | Level 1 include/exclude filters |
| Adzuna credentials | `.env` — `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | |

## Steps

### 1. Verify prerequisites
```bash
# Confirm env vars are loaded
echo $ADZUNA_APP_ID
# Confirm sources file is configured
cat config/sources.yaml
```

### 2. Run capture + score + full pipeline
```bash
npm run jobops:capture    # Capture only
npm run jobops:score      # Score only
npm run jobops:full       # Capture → enrich → score → store → handoff
npm run jobops:all-sites  # Full run across all sources in sources.yaml
```

### 3. Review output
Output lands in `tmp/jobops-pipeline/`. Key file:
- `tmp/jobops-pipeline/latest-all-sites-jobs.md` — consolidated results

### 4. Handoff to n8n
The pipeline POSTs scored batches to the n8n webhook automatically (see `workflows/n8n-integration.md`).
The webhook endpoint is set in `.env` as `N8N_WEBHOOK_URL`.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Rate limited on Adzuna | Wait 60s, retry. Check Adzuna dashboard for quota. |
| Source returns 0 results | Check `config/sources.yaml` page_url — site may have changed structure |
| n8n webhook returns non-200 | Verify JOBSEARCHOPS workflow is active in n8n. See `workflows/n8n-integration.md` |

## Expected Outputs

- `tmp/jobops-pipeline/latest-all-sites-jobs.md` — markdown report
- n8n receives batch payload at `POST /webhook/jobsearchops/joboffers`

## Tuning Filters

Edit `config/keywords.yaml` before re-running:
- `level_1_keywords` — titles/phrases to match
- `level_1_excluded_title_keywords` — title keywords to block
- `level_1_excluded_exact_titles` — exact titles to block
- `level_1_excluded_organizations` — orgs to skip
- `level_1_excluded_work_options` — e.g., `on-site`

## Tools Used

- `tools/job-source-adapters/canada-ca.adapter.mjs` — Canada.ca link discovery
- `src/capture/adapters/adzuna.mjs` — Adzuna API adapter
- `scripts/jobops-run-*.mjs` — Pipeline entry points
