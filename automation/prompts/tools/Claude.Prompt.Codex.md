# Claude - Codex Prompt

## Objective

Prepare Claude as the AI provider for AgentOps.

## Checklist

- [ ] shared/AgentOps exists
- [ ] agents folder exists
- [ ] prompts folder exists
- [ ] schemas folder exists
- [ ] ANTHROPIC_API_KEY documented in .env.example
- [ ] ANTHROPIC_MODEL documented
- [ ] no API key committed

## Validation

```bash
grep ANTHROPIC .env.example
git ls-files .env
```
