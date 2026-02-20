# Dashboard Mode

If `/e2e` is invoked **without a subcommand**, show a unified dashboard:

## Step 1: Gather data from filesystem

1. Read `e2e-scenarios/COVERAGE.md` (if it exists) to get the feature catalog (Feature + Description pairs)
2. Use **Glob** to find all `e2e-scenarios/**/scenario.md` files
3. Use **Glob** to find all `e2e-scenarios/**/scenario.spec.ts` files
4. Use **Grep** to count `## Scenario:` headings across all `scenario.md` files

## Step 2: Infer status for each feature

For each feature in the catalog, derive its scenario path from the feature name (kebab-case) and check:

| Status | How to determine |
|--------|-----------------|
| **Spec ready** | Both `scenario.md` and `scenario.spec.ts` exist in `e2e-scenarios/<path>/` |
| **Scenario only** | `scenario.md` exists but `scenario.spec.ts` does not |
| **Not covered** | No `scenario.md` found at the expected path |

Also include any `scenario.md` files found on disk that are NOT listed in the catalog (these were created without running explore).

## Step 3: Display the table

```
## E2E Dashboard

| Feature | Scenarios | Status | Next Action |
|---------|-----------|--------|-------------|
| **Contracts - Create/Edit** — Form with contract number, entity, type, dates... | 10 | Spec ready | `/e2e contracts/create-edit` |
| **Contracts - List** — Filters, sorting, pagination, export | 12 | Spec ready | `/e2e contracts/list` |
| **Deals - Creation** — Multi-step wizard: details, quantities, review | 2 | Scenario only | `/e2e deals/creation` |
| **Deals - Delete** — Delete with confirmation dialog | — | Not covered | `/e2e build deals/delete` |
| ... | ... | ... | ... |

**Total:** N features — X spec ready, Y scenario only, Z not covered
```

- **Feature**: Bold name followed by ` — ` and the short description, all in one cell
- **Scenarios**: Count `## Scenario:` headings in `scenario.md`, or `—` if no file
- **Next Action**: The command to run next, based on status:
  - **Spec ready** → `/e2e <area>/<name>` (run the spec)
  - **Scenario only** → `/e2e <area>/<name>` (generate + run the spec)
  - **Not covered** → `/e2e build <area>/<name>` (author the scenario)
  - For "Not covered" rows, derive a kebab-case path from the feature name (e.g., "Deals - Delete" → `deals/delete`)
- If no `COVERAGE.md` exists, build the table from discovered `scenario.md` files only and suggest running `/e2e explore` to discover uncovered features

## Step 4: Show usage hints

```
### Commands
  /e2e explore                              Scan codebase for coverage gaps
  /e2e build <area>/<flow>                  Author a new scenario
  /e2e <area>/<scenario>                    Run spec (generate if needed)
  /e2e <area>/<scenario> --regenerate       Force spec regeneration
  /e2e <area>/<scenario> --headless         Run headless (no visible browser)
```

**Stop here** — this is a read-only view.
