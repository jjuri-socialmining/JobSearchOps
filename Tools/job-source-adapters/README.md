# Job Source Adapters

Runtime helpers for source-specific discovery that we want to reuse outside `src/`.

## Current adapters

- `canada-ca.adapter.mjs`
  - Dedicated discovery for `canada.ca` job pages.
  - Best for registry pages and departmental job-opportunity pages.

## How to extend

1. Add a new adapter file here.
2. Expose a thin wrapper in `src/capture/adapters/`.
3. Register the adapter in `src/capture/source-runner.mjs`.
4. Update `scripts/jobops-sync-prompt-sources.mjs` domain routing so prompt-added URLs can auto-select the right adapter.

## Design rule

Prompt-added pages should not stay as passive documentation.
If a domain is known here, the sync step should promote it into the runtime automatically.
