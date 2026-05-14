---
type: "tools_dashboard"
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
ai_value_rank: "⭐⭐⭐⭐"
generated_by: "xops-control-center"
generated_at: "2026-04-26 14:40"
generator_script: "../../Automation/automation/dashboard/xops-control-center.mjs"
tooling_status: "🟡 PARTIAL"
tool_next_action_mode: "static_until_obsidian_copilot"
prompt_directory: "automation/prompts/tools"
github_bootstrap_script: "_gitops/automation/project-bootstrap/new-governed-project.sh"
obsidian_status: "🟢 ACTIVE"
github_status: "🟢 ACTIVE"
node_status: "v20.20.0"
npm_status: "10.9.4"
---

# JobSearchOps - Tools

## Update

Usa este boton para refrescar el inventario de herramientas, su evidencia y los siguientes pasos del dashboard:

```button
name Update Tool Statuses
type link
action file:///Volumes/Storage/PKM/JobOps-OS/JobSearchOps/_automation/dashboard/update-control-center.command
color green
```

Fallback shell directo:

```bash
bash _automation/dashboard/update-control-center.sh
```

## Next Action Mode

- Hoy la columna `Next Action` es estatica y se calcula desde reglas del generador.
- Cuando conectes Obsidian Copilot u otra capa de navegacion contextual, esa columna puede evolucionar a sugerencias dinamicas basadas en lo que estas recorriendo en el repo.
- La fuente de verdad actual sigue siendo este diagnostico generado, para mantener trazabilidad y consistencia.

| Tool | Status | Purpose | Evidence | Codex Prompt | Bash Script | Next Action |
|---|---|---|---|---|---|---|
| [[GitHub]] | 🟢 ACTIVE | Repo, governance, branch strategy, CI/CD foundation | https://github.com/jjuri-socialmining/JobSearchOps.git | [GitHub.Prompt.Codex.md](../automation/prompts/tools/GitHub.Prompt.Codex.md) | [`new-governed-project.sh`](../_gitops/automation/project-bootstrap/new-governed-project.sh) | Usar el bootstrap gobernado y validar remote + workflows. |
| [[VS Code]] | 🟢 ACTIVE | IDE principal para implementación local | vscode:// links generated | [VSCode.Prompt.Codex.md](../automation/prompts/tools/VSCode.Prompt.Codex.md) | - | Documentar extensiones y ajustes opcionales. |
| [[Codex]] | 🟢 ACTIVE | Implementación guiada por prompts versionados | automation/prompts exists | [Codex.Prompt.Codex.md](../automation/prompts/tools/Codex.Prompt.Codex.md) | - | Mantener prompts atomicos y versionados. |
| [[Obsidian]] | 🟢 ACTIVE | Control Center, dashboards y PKM operacional | automation/docs exists | [Obsidian.Prompt.Codex.md](../automation/prompts/tools/Obsidian.Prompt.Codex.md) | - | Mantener dashboards y MOCs auditables. |
| [[Node.js]] | 🟢 ACTIVE | Scripts de automatización, dashboard y validación | v20.20.0 | [Node.Prompt.Codex.md](../automation/prompts/tools/Node.Prompt.Codex.md) | - | Expandir scripts de validacion. |
| [[06 - $33.28 - Claude]] | 🔴 NOT STARTED | AgentOps / AI agents en SDLC | missing ANTHROPIC_API_KEY | [Claude.Prompt.Codex.md](../automation/prompts/tools/Claude.Prompt.Codex.md) | - | Implementar AgentOps runner y contratos. |
| [[Todoist]] | 🔴 NOT STARTED | TaskOps y ejecución humana controlada | missing TODOIST_API_TOKEN | [Todoist.Prompt.Codex.md](../automation/prompts/tools/Todoist.Prompt.Codex.md) | - | Documentar reglas anti-duplicado y seguimiento. |
| [[n8n]] | 🔴 NOT STARTED | FlowOps, orquestación, cron, webhooks | n8n/ missing | [n8n.Prompt.Codex.md](../automation/prompts/tools/n8n.Prompt.Codex.md) | - | Definir export policy, retry y webhooks. |
| [[Google Sheets]] | 🔴 NOT STARTED | StateOps / state store operacional | missing GOOGLE_SHEETS_ID | [GoogleSheets.Prompt.Codex.md](../automation/prompts/tools/GoogleSheets.Prompt.Codex.md) | - | Definir schema de estado y tabs. |
