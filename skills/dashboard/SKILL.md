---
name: dashboard
description: Use when the user asks for the status of the E2E tests or the test coverage, says "e2e dashboard", "e2e status", "e2e overview", or "show e2e status", or invokes /e2e:dashboard.
---

# E2E Dashboard

Show the status of each feature and each scenario. This skill reads files. It does not change a file and it does not run a test.

## Procedure

1. Run this command from the project root:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../run/scripts/e2e.mjs" status
   ```
   The script is in the `run` skill, which is installed next to this skill. If the path starts with a `---
name: dashboard
description: Use when the user asks for the status of the E2E tests or the test coverage, says "e2e dashboard", "e2e status", "e2e overview", or "show e2e status", or invokes /e2e:dashboard.
---

# E2E Dashboard

Show the status of each feature and each scenario. This skill reads files. It does not change a file and it does not run a test.

## Procedure

1. Run this command from the project root:

   ```bash
   node "${CLAUDE_SKILL_DIR}/../run/scripts/e2e.mjs" status
   ```
 variable that has no value, use the folder of this file in its place. If the script is missing, tell the human to install the `run` skill from `abdielou/e2e-skill`. Then stop.
2. Print its output without changes. Do not calculate a status yourself.
3. If a row shows `Spec stale`, `Contract gap`, `Spec has no contract`, a skipped test, or a failed last run, add one line below the table that names the row and its next action.
4. Print the commands:

   ```
   /e2e:explore                              Find features that have no scenario
   /e2e:build <area>/<scenario>              Write a scenario
   /e2e:run <area>/<scenario>                Run the spec. Generate it first if necessary
   /e2e:run <area>/<scenario> --regenerate   Generate the spec again
   ```

## Columns

| Column | Source |
|--------|--------|
| Feature, Path | `e2e-scenarios/COVERAGE.md`, plus each scenario folder that the catalog does not list |
| Scenarios | The `## Scenario:` headings in `scenario.md` |
| Spec | The comparison of `scenario.spec.ts` with `scenario.md`. See the states in `${CLAUDE_SKILL_DIR}/../run/reference/project-layout.md` |
| Last run | The result that `/e2e:run` wrote on this machine |
| Open findings | The lines with `- [ ]` in `findings.md` |
