---
type: "workflows_dashboard"
project: "JobSearchOps"
project_type: "X.Ops"
repo_status: "not_initialized"
current_phase: "Foundation"
overall_status: "🔴 NOT STARTED"
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
ci_status: "🔴 NOT STARTED"
n8n_status: "🔴 NOT STARTED"
workflow_count: 0
required_workflows_missing: []
local_entrypoint: "npm run xops:control"
symlink_entrypoint: "node _automation/dashboard/xops-control-center.mjs"
---

# JobSearchOps - Workflows

| Workflow | Type | Status | Trigger | Evidence | Next Action |
|---|---|---|---|---|---|

| JobSearchOps Scheduled Search | n8n | 🔴 NOT STARTED | schedule | missing | Design workflow |
| JobSearchOps Manual Search | n8n | 🔴 NOT STARTED | manual/webhook | missing | Design workflow |
| XOps Control Center | local script | 🟢 ACTIVE | manual | ../../Automation/automation/dashboard/xops-control-center.mjs | Keep shared path stable |
