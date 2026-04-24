---
type: "control_center"
project: "JobSearchOps"
project_type: "X.Ops"
repo_status: "active"
current_phase: "Foundation"
overall_status: "🟡 PARTIAL"
last_validation: "2026-04-24"
owner: "Jorge"
focus_module: "JobSearchOps"
github_repo: "https://github.com/jjuri-socialmining/JobSearchOps.git"
local_path: "/Volumes/Storage/PKM/JobOps-OS/JobSearchOps"
vscode_link: "vscode://file/Volumes/Storage/PKM/JobOps-OS/JobSearchOps"
obsidian_moc: "[[JobSearchOps.MOC]]"
created: "2026-04-24"
updated: "2026-04-24"
review_frequency: "daily"
maturity_level: "foundation"
automation_level: "manual"
source_of_truth: "local_repo"
generated_by: "xops-control-center"
generated_at: "2026-04-24 04:09"
generator_script: "../../Automation/automation/dashboard/xops-control-center.mjs"
---

# JobSearchOps - Control Center

#control_center

## Status Summary

| View         | Status         | Purpose                                    | Link                         | Next Step                                                |
| ------------ | -------------- | ------------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| Tools        | 🟡 PARTIAL     | Tooling inventory and governed entrypoints | [[JobSearchOps.Tools]]       | Iniciar prompts versionados y bootstrap por herramienta. |
| Workflows    | 🟢 ACTIVE      | CI/CD, automations, and entrypoints        | [[JobSearchOps.Workflows]]   | Completar workflows requeridos.                          |
| Agents       | 🔴 NOT STARTED | Agent catalog and execution readiness      | [[JobSearchOps.Agents]]      | Iniciar shared/AgentOps.                                 |
| Technical    | 🟡 PARTIAL     | Git, env, workflows, and release hygiene   | [[JobSearchOps.Technical]]   | Completar hygiene, release y validaciones.               |
| Operational  | 🔴 NOT STARTED | Risks, blockers, and next actions          | [[JobSearchOps.Operational]] | Iniciar decision log, riesgos y evidencia operacional.   |
| JobSearchOps | 🔴 NOT STARTED | Current focus module health                | [[JobSearchOps.Dashboard]]   | Iniciar modules/JobSearchOps.                            |

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
- [`update-control-center.sh`](../automation/dashboard/update-control-center.sh)

Nota:
- El boton abre `update-control-center.command`, que relanza el generador para regenerar JobSearchOps.ControlCenter.md y todos los dashboards relacionados.
- Si macOS bloquea la primera ejecucion, abre el archivo una vez desde Finder y autoriza su ejecucion.

## Urgent Improvement Contracts

| Improvement | Urgency | Artifact | Path | Next Action |
|---|---|---|---|---|
| Release Discipline | High | CHANGELOG | CHANGELOG.md | Document rollback guidance in CHANGELOG.md. |
| Handoff Contract | High | Schema | modules/JobSearchOps/schemas/handoff.schema.json | Create modules/JobSearchOps/schemas/handoff.schema.json with required fields, output payload and status mapping. |
| Run Log Contract | High | Schema | modules/JobSearchOps/schemas/run-log.schema.json | Create modules/JobSearchOps/schemas/run-log.schema.json with run ids, counters, timestamps, status and error fields. |
| State Model | Medium | Schema | modules/JobSearchOps/schemas/state.schema.json | Create modules/JobSearchOps/schemas/state.schema.json before scaling tabs, dashboards or external state stores. |

## Missing Items

- working tree clean

## Next Actions

1. Document rollback guidance in CHANGELOG.md.
2. Create modules/JobSearchOps/schemas/handoff.schema.json with required fields, output payload and status mapping.
3. Create modules/JobSearchOps/schemas/run-log.schema.json with run ids, counters, timestamps, status and error fields.
4. Create modules/JobSearchOps/schemas/state.schema.json before scaling tabs, dashboards or external state stores.
5. Create the focus module at modules/JobSearchOps.
6. Create shared/AgentOps for agent definitions and runners.
7. Create shared/ObserveOps to retain run evidence and logs.

## Dashboards

- [[JobSearchOps.Tools]]
- [[JobSearchOps.Workflows]]
- [[JobSearchOps.Agents]]
- [[JobSearchOps.Technical]]
- [[JobSearchOps.Operational]]
- [[JobSearchOps.Dashboard]]
- [[JobSearchOps.Sources]]
- [[JobSearchOps.Runs]]
- [[JobSearchOps.Handoff]]
