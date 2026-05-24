# Agent Instructions
You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.
## The WAT Architecture
**Layer1 Workflows (The Instructions)**
- Markdown SOPs stored in
workflows/"
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, to handle edge cases
- written in plain language, the same way you'd brief someone on your team
**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and clarifying questions when needed
- You connect intent to execution without trying to do everything yourself
- Example: If you need to pull data from a website, don't attempt it directly. Read
*workflows/scrape_website.md", figure out the required inputs, then execute
*tools/scrape_single_site.py
**Layer 3: Tools (The Execution) **
- Python scripts in tools/ that do the actual work
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in
• env
- These scripts are consistent, testable, and fast
**why this matters:** when AI tries to handle every step directly, accuracy drops fast. If each is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to operate
**1. Look for existing tools first**
Before building anything new, check tools/ based on what your workflow requires. only create new scripts when nothing exists for that task.
**2. Learn and adapt when things fail**
When you hit an error:
the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with me before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)
Example: You get rate-limited on an API, so you dig into the docs, discover a batch endpoint, refactor the tool to use it, verify it works, then update the workflow so this never happens again
**3. Keep workflows current**
Workflows
should evolve as you learn. When you find better methods, discover constraints, or encounter
recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to. These are your instructions and need to be preserved and refined, not tossed after one use.
## The Self-Improvement Loop
Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system
This loop is how the framework improves over time.

## File Structure
**What goes where:**
- **Deliverables**: Final outputs go to cloud services (Google Sheets, Slides, etc.) where I access them directly
- **Intermediates**: Temporary processing files that can be regenerated
**Directory layout:**
• tmp/
tools/
# Temporary files (scraped data, intermediate exports). Regenerated as needed.
# Python scripts for deterministic execution
workflows/
# Markdown SOPs defining what to do and how
• env
# API keys and environment variables (NEVER
store secrets anywhere else
credentials. ison,
token. json #GooglOAth (gitignored)
**Core principle:** Local files are just for processing. Anything I need to see or use lives in cloud services. Everything in . tmp/ is disposable.
## Bottom Line
sit between what I want (workflows) and what actually gets done (tools). Your job is to read
instructions, make smart decisions, call the right tools, recover from errors, and keep improving system as you go.
Stay pragmatic. Stay reliable. Keep learning.

---

## Quick Reference

### Entry points

| Script | Command | What it does |
|---|---|---|
| `prestart` | `npm start` | Validates all required env vars (runs automatically before `start`) |
| `jobops:capture` | `npm run jobops:capture` | Fetch jobs from all enabled sources → `tmp/jobops-pipeline/latest-capture.json` |
| `jobops:enrich` | `npm run jobops:enrich` | AI enrichment: fetch JD pages + summarize → `latest-enriched.json` |
| `jobops:score` | `npm run jobops:score` | Score enriched jobs → `latest-scored.json` |
| `jobops:full` | `npm run jobops:full` | Full pipeline: capture → enrich → score in one pass |
| `jobops:test:level1` | `npm run jobops:test:level1` | BC Gov only: capture + score + export level-1 markdown report |
| `jobops:all-sites` | `npm run jobops:all-sites` | Run all sources via shell wrapper (`scripts/jobops-run-all-sources.sh`) |
| `jobops:sync-prompt-sources` | `npm run jobops:sync-prompt-sources` | Sync the prompt source registry JSON from sources.yaml |
| `jobops:qc` | `npm run jobops:qc` | Interactive QC gate: review jobs, generate QC report, prompt for approval |
| `jobops:qc:approve` | `npm run jobops:qc:approve` | Auto-approve current opportunity inventory |
| `jobops:qc:report` | `npm run jobops:qc:report` | Generate QC markdown report only (no approval prompt) |
| `jobops:dashboard` | `npm run jobops:dashboard` | Export dashboard HTML to `tmp/jobops-pipeline/dashboard.html` |

---

### Required env vars

Copy `.env.example` → `.env` and fill in:

| Variable | Purpose |
|---|---|
| `ADZUNA_APP_ID` | Adzuna API application ID — register free at https://developer.adzuna.com |
| `ADZUNA_APP_KEY` | Adzuna API application key |
| `ANTHROPIC_API_KEY` | Anthropic API key — used by `src/enrich/jd-summarizer.mjs` for AI enrichment |

All other `JOBOPS_*` vars in `.env.example` are optional runtime overrides with safe defaults.

---

### Directory map (corrected)

```
src/
  capture/
    adapters/*.mjs      ← MAIN adapter layer (bc-gov, adzuna, civicjobs, generic-careers-page, …)
    source-runner.mjs   ← Orchestrates adapters, applies keyword filters, dedup
  enrich/               ← JD fetcher, AI summarizer
  score/                ← Scoring logic
  store/                ← Output writers: Google Sheets payload, Obsidian export
  handoff/              ← Writes opportunity-inventory.json
  lib/                  ← Shared utilities: config-loader, file-utils, job-normalizer, dedup-store

config/                 ← sources.yaml, keywords.yaml, pipeline.yaml, scoring.yaml
scripts/                ← Pipeline entry points (called by npm run scripts above)
workflows/              ← SOPs: capture.md, n8n-integration.md
tools/job-source-adapters/  ← Thin delegate for canada-ca ONLY — not the main adapter layer
tmp/jobops-pipeline/    ← Disposable pipeline outputs (regenerated each run)
automation/             ← Dashboard generator, docs, source registry
```

> `tools/job-source-adapters/` contains one file (`canada-ca.adapter.mjs`). It is called by
> `src/capture/adapters/canada-ca.mjs` as a thin wrapper. All other adapters live entirely in
> `src/capture/adapters/`.

---

### Active sources

Three sources are currently enabled in `config/sources.yaml`:

| Priority | ID | Name | Method |
|---|---|---|---|
| 100 | `bc-gov` | BC Government Careers | `public-html` — paginates the public BC job board |
| 95 | `civicjobs` | CivicJobs.ca | `rss-xml` — BC province RSS feed |
| 88 | `adzuna-bc` | Adzuna BC (covers Indeed + more) | `json-api` — requires `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` |

Seven additional sources exist in the registry but are disabled. Do not enable them without
reviewing their adapter status (`src/capture/adapters/`) — several are stubs.

---

### Quality gate

```bash
node scripts/jobops-qc-gate.mjs              # interactive: review + approval prompt
node scripts/jobops-qc-gate.mjs --report-only # generate QC markdown only
node scripts/jobops-qc-gate.mjs --approve     # auto-approve current inventory
```

The QC gate reads `opportunity-inventory.json`, validates enriched jobs, and produces:
- A per-job table: fit emoji (🟢 STRONG / 🟡 POSSIBLE / 🔴 WEAK), score, title, org, location, summary, signals
- A `qc-report.md` for Obsidian review
- Approval status written back to the inventory

Run after `jobops:full` and before pushing results to Google Sheets.

---

### Stop conditions (Rule 8 — ai-guardrails.md)

**Stop and ask the user before doing any of the following:**

- Changing `enabled: true/false` on any source in `config/sources.yaml`
- Deleting or bulk-clearing contents of `tmp/` (pipeline state lives here between steps)
- Modifying `src/store/sheets-store.mjs` or the Google Sheets payload output format
- Changing score weights, thresholds, or fit labels in `config/scoring.yaml`

These actions have downstream effects (lost run state, broken Google Sheets import, score drift)
that are hard to reverse without re-running the full pipeline.