# JobSearchOps

Sistema JobOps orientado a `capture -> enrich -> score -> store -> decision`.

## Entrypoints

- `npm run jobops:capture`
- `npm run jobops:enrich`
- `npm run jobops:score`
- `npm run jobops:full`
 - `npm run jobops:all-sites`
 - `npm run jobops:sync-prompt-sources`

## Config

- `config/sources.yaml`
- `config/scoring.yaml`
- `config/pipeline.yaml`

## Docs

- [JobSearchOps.Sources](automation/docs/JobSearchOps.Sources.md)
- [JobSearchOps.ControlCenter](automation/docs/JobSearchOps.ControlCenter.md)
- [JobSearchOps.MOC](automation/docs/JobSearchOps.MOC.md)
- [Schema Mandatorio](schemas/jobsearchops-schema.md)

## JobOps Level 1 - Capture

Current main pipeline:
- `src/`
- `scripts/jobops-run-*.mjs`
- `config/sources.yaml`
- `config/scoring.yaml`

Prompt source auto-registration:
- `scripts/jobops-sync-prompt-sources.mjs`
- `automation/sources/jobops-runtime-registry.json`
- `automation/docs/jobops-search-pages.md`

Domain adapters toolbox:
- `Tools/job-source-adapters/`
- add reusable domain logic there first, then expose a thin wrapper in `src/capture/adapters/`

Agents:
- `.codex/agents/AGENTS-INDEX.md`
- use this index to choose between search architecture, source debugging, scoring governance, and capture operations

Legacy/fallback:
- `scripts/jobsearchops/`

Run:

```bash
npm run jobops:capture
npm run jobops:score
npm run jobops:full
npm run jobops:test:level1
npm run jobops:all-sites
```

## Ajustar Filtros

Edita [config/keywords.yaml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/config/keywords.yaml) antes de volver a correr:

- `level_1_keywords`: cargos o frases que si quieres encontrar
- `level_1_excluded_title_keywords`: cargos o palabras de titulos que no te interesan
- `level_1_excluded_exact_titles`: titulos exactos que quieres bloquear
- `level_1_excluded_organizations`: organizaciones que no quieres ver
 - `level_1_excluded_post_keywords`: palabras dentro del post que quieres bloquear
 - `level_1_excluded_work_options`: modalidades no deseadas como `on-site`

Despues vuelve a correr:

```bash
npm run jobops:test:level1
npm run jobops:all-sites
```

Known architecture decision:
The Node pipeline is the main runtime. The prompt-driven n8n flow is preserved as legacy/fallback only.

## Wrapper operativo multi-source

- `scripts/jobsearchops/buscar_trabajo_general_bc.sh` ahora usa por defecto la pipeline Node principal sobre todas las fuentes configuradas en `config/sources.yaml`
- usa los filtros de `config/keywords.yaml`
- sincroniza automaticamente el bloque `## Fuentes` del prompt hacia:
  - `automation/docs/jobops-search-pages.md`
  - `automation/sources/jobops-prompt-sources.json`
- genera el consolidado en `tmp/jobops-pipeline/latest-all-sites-jobs.md`
- para forzar el flujo legacy prompt-driven:

```bash
LEGACY_PROMPT_FLOW=1 bash scripts/jobsearchops/buscar_trabajo_general_bc.sh
```
