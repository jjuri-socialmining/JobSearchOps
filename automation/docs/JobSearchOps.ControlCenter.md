---
type: "control_center"
project: "JobSearchOps"
project_type: "X.Ops"
repo_status: "active"
current_phase: "Foundation"
overall_status: "🟡 PARTIAL"
last_validation: "2026-04-26"
owner: "Jorge"
focus_module: "JobSearchOps"
github_repo: "https://github.com/jjuri-socialmining/JobSearchOps.git"
local_path: "/Volumes/Storage/PKM/JobOps-OS/JobSearchOps"
vscode_link: "vscode://file/Volumes/Storage/PKM/JobOps-OS/JobSearchOps"
obsidian_moc: "[[JobSearchOps.MOC]]"
created: "2026-04-26"
updated: "2026-04-26"
review_frequency: "daily"
maturity_level: "foundation"
automation_level: "manual"
source_of_truth: "local_repo"
uuid: "e878e721-2101-4db0-a6db-793a545ae17b"
updated_at: "2026-04-26 14:40"
updated_at_utc: "2026-04-26T14:40:38.286Z"
updated_epoch_ms: 1777214438286
updated_package_at: "2026-04-26 14:40"
updated_package_uuid: "e878e721-2101-4db0-a6db-793a545ae17b"
author: "CODEX"
prompt_author: "Jorge"
code_author: "CODEX"
validated_by: ""
validation_status: "pending_human_review"
tags: "📝/🌱/♻️"
continuous_improvement_tag: "♻️"
ai_value_rank: "⭐⭐⭐⭐⭐"
generated_by: "xops-control-center"
generated_at: "2026-04-26 14:40"
generator_script: "../../Automation/automation/dashboard/xops-control-center.mjs"
---

# JobSearchOps - Control Center

#control_center

## Status Summary

| View         | Status         | Purpose                                                  | Link                         | Next Step                                                                         |
| ------------ | -------------- | -------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Tools        | 🟡 PARTIAL     | Tooling inventory and governed entrypoints               | [[JobSearchOps.Tools]]       | Iniciar prompts versionados y bootstrap por herramienta.                          |
| Workflows    | 🟢 ACTIVE      | CI/CD, automations, and entrypoints                      | [[JobSearchOps.Workflows]]   | Completar workflows requeridos.                                                   |
| Agentic AI   | 🟢 ACTIVE      | Shared agent catalog, detection, and execution readiness | [[JobSearchOps.AgenticAI]]   | Crear Agents AI Essentials y sincronizar dist/codex/agents/ hacia .codex/agents/. |
| Technical    | 🟡 PARTIAL     | Git, env, workflows, and release hygiene                 | [[JobSearchOps.Technical]]   | Iniciar .env.example.                                                             |
| Operational  | 🔴 NOT STARTED | Risks, blockers, and next actions                        | [[JobSearchOps.Operational]] | Iniciar decision log, riesgos y evidencia operacional.                            |
| JobSearchOps | 🔴 NOT STARTED | Current focus module health                              | [[JobSearchOps.Dashboard]]   | Iniciar modules/JobSearchOps.                                                     |

## Update

Use este boton en Obsidian para lanzar el refresh de diagnostico del repo desde macOS:

```button
name Update All Statuses
type link
action file:///Volumes/Storage/PKM/JobOps-OS/JobSearchOps/_automation/dashboard/update-control-center.command
color blue
```

Fallback shell directo:

```bash
bash _automation/dashboard/update-control-center.sh
```

Script:
- [`update-control-center.command`](../_automation/dashboard/update-control-center.command)
- [`update-control-center.sh`](../_automation/dashboard/update-control-center.sh)

Nota:
- El boton abre `update-control-center.command`, que relanza el generador para refrescar el diagnostico completo del repo.
- El refresh regenera JobSearchOps.ControlCenter.md, los dashboards relacionados y los prompt `.md` gestionados por este generador.
- El refresh no reescribe scripts arbitrarios del repo, pero si reevalua sus rutas, evidencias y siguientes pasos dentro del diagnostico.
- Si macOS bloquea la primera ejecucion, abre el archivo una vez desde Finder y autoriza su ejecucion.

## Urgent Improvement Contracts

| Improvement | Urgency | Artifact | Path | Next Action |
|---|---|---|---|---|
| Release Discipline | High | CHANGELOG | CHANGELOG.md | Document rollback guidance in CHANGELOG.md. |
| Handoff Contract | High | Schema | modules/JobSearchOps/schemas/handoff.schema.json | Create modules/JobSearchOps/schemas/handoff.schema.json with required fields, output payload and status mapping. |
| Run Log Contract | High | Schema | modules/JobSearchOps/schemas/run-log.schema.json | Create modules/JobSearchOps/schemas/run-log.schema.json with run ids, counters, timestamps, status and error fields. |
| State Model | Medium | Schema | modules/JobSearchOps/schemas/state.schema.json | Create modules/JobSearchOps/schemas/state.schema.json before scaling tabs, dashboards or external state stores. |

## Missing Items

- .env.example
- working tree clean

## Next Actions

1. Document rollback guidance in CHANGELOG.md.
2. Create modules/JobSearchOps/schemas/handoff.schema.json with required fields, output payload and status mapping.
3. Create modules/JobSearchOps/schemas/run-log.schema.json with run ids, counters, timestamps, status and error fields.
4. Create modules/JobSearchOps/schemas/state.schema.json before scaling tabs, dashboards or external state stores.
5. Create .env.example with the integration contract.
6. Create the focus module at modules/JobSearchOps.
7. Create Agents AI Essentials as the shared source catalog and sync dist/codex/agents/ into each repo's .codex/agents/.

## Dashboards

- [[JobSearchOps.Tools]]
- [[JobSearchOps.Workflows]]
- [[JobSearchOps.AgenticAI]]
- [[JobSearchOps.Technical]]
- [[JobSearchOps.Operational]]
- [[JobSearchOps.Dashboard]]
- [[JobSearchOps.Sources]]
- [[JobSearchOps.Runs]]
- [[JobSearchOps.Handoff]]
