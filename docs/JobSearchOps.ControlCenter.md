---
type: "control_center"
project: "JobSearchOps"
project_type: "X.Ops"
repo_status: "not_initialized"
current_phase: "Foundation"
overall_status: "🟡 PARTIAL"
last_validation: "2026-04-24"
owner: "Jorge"
focus_module: "JobSearchOps"
github_repo: ""
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
generated_at: "2026-04-24 01:20"
generator_script: "../../Automation/automation/dashboard/xops-control-center.mjs"
---

# JobSearchOps - Control Center

## Status Summary

| View | Status | Purpose | Link | Next Step |
|---|---|---|---|---|
| Tools | 🟡 PARTIAL | Tooling inventory and governed entrypoints | [[JobSearchOps.Tools]] | Iniciar prompts versionados y bootstrap por herramienta. |
| Workflows | 🔴 NOT STARTED | CI/CD, automations, and entrypoints | [[JobSearchOps.Workflows]] | Iniciar .github/workflows. |
| Agents | 🔴 NOT STARTED | Agent catalog and execution readiness | [[JobSearchOps.Agents]] | Iniciar shared/AgentOps. |
| Technical | 🔴 NOT STARTED | Git, env, workflows, and release hygiene | [[JobSearchOps.Technical]] | Iniciar .env.example. |
| Operational | 🔴 NOT STARTED | Risks, blockers, and next actions | [[JobSearchOps.Operational]] | Iniciar decision log, riesgos y evidencia operacional. |
| JobSearchOps | 🔴 NOT STARTED | Current focus module health | [[JobSearchOps.Dashboard]] | Iniciar modules/JobSearchOps. |

cuando se genere el script de nuevo agrega este tag #control_center al archivo JobSearchOps.ControlCenter.md // 2)


## Missing Items

- README.md
- AGENTS.md
- .gitignore
- .env.example
- .github/workflows
- working tree clean

## Next Actions

1. Initialize the repository with git init.
2. Create .env.example with the integration contract.
3. Create .github/workflows with the validation pipelines.
4. Create the focus module at modules/JobSearchOps.
5. Create shared/AgentOps for agent definitions and runners.
6. Create shared/ObserveOps to retain run evidence and logs.

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
