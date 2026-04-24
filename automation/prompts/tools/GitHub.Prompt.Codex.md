# GitHub - Codex Prompt

## Objective

Implement or bootstrap the GitHub foundation for a governed X.Ops project using the existing bootstrap script:

```text
_gitops/automation/project-bootstrap/new-governed-project.sh
```

## Context

This prompt belongs to the X.Ops Automation system. It is used to create or validate a project with:

- Git initialized
- main branch
- GitHub remote
- root governance files
- README
- AGENTS
- .gitignore
- .env.example
- initial CI/CD structure
- project baseline
- release discipline

## Source Files

- _gitops/automation/project-bootstrap/README.md
- _gitops/automation/project-bootstrap/new-governed-project.sh

## Bootstrap Findings

- Creates local and remote repositories.
- Creates the first commit.
- Pushes the main branch.
- Generates FIRST_COMMIT_GITHUB_INIT_CHECKLIST.md.
- Delegates to _gitops/scripts/new-governed-project.sh.

## Prerequisites

- Run from the target project root.
- `_gitops` must exist and point to the official GitOps distribution.
- The distributed bootstrap script must exist at `_gitops/scripts/new-governed-project.sh`.
- Review the current git status before running.

## Variables and Environment Assumptions

- Current working directory is the target project root.
- _gitops is the official symlink entrypoint.
- The wrapper script delegates to:

```text
_gitops/scripts/new-governed-project.sh
```

## Instructions for Codex

1. Read the bootstrap README and wrapper script.
2. Verify the target project path and current git status.
3. Confirm _gitops exists before execution.
4. Do not overwrite an existing repository blindly; explain the detected state in comments or notes.
5. Run the bootstrap only when the repo foundation is missing or explicitly being validated.
6. Ensure .env is ignored.
7. Ensure .env.example exists.
8. Ensure CHANGELOG.md exists.
9. Ensure .github/workflows/ exists if the bootstrap or post-bootstrap steps support it.
10. Ensure the first commit outcome is clear and auditable.

## Execution Command

```bash
bash ./_gitops/automation/project-bootstrap/new-governed-project.sh
```

## Validation Commands

```bash
git status
git branch --show-current
git remote -v
git log --oneline -5
ls .github/workflows
ls
```

## Expected Result

- Project created or validated.
- Git repository initialized.
- Governance files present.
- CI/CD foundation created or ready for completion.
- CHANGELOG.md present.
- Working tree clean or with a clearly staged next commit.

## Checklist

- [ ] Git initialized
- [ ] main branch
- [ ] remote origin configured
- [ ] README.md
- [ ] AGENTS.md
- [ ] .gitignore
- [ ] .env.example
- [ ] CHANGELOG.md
- [ ] .github/workflows
- [ ] initial commit
- [ ] status dashboard generated

## Rollback

If the bootstrap created unwanted files:

```bash
git status
git restore .
git clean -fd
```

If the repo was initialized incorrectly:

```bash
rm -rf .git
```

## Suggested Commit

```bash
git add .
git commit -m "chore: bootstrap governed X.Ops project"
```
