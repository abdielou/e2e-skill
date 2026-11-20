---
name: e2e-dashboard
description: Use when the user asks for the status of the E2E tests or the test coverage, says "e2e dashboard", "e2e status", "e2e overview", or "show e2e status", or invokes /e2e:dashboard.
---

# E2E Dashboard

Show the status of each feature and each scenario. This skill reads files. It does not change a file and it does not run a test.

## Procedure

1. Run this command from the project root:

   ```bash
   node "<run>/scripts/e2e.mjs" status
   ```
   `<run>` is the folder of the run skill, next to the folder of this skill. Its name is `run` in the plugin and `e2e-run` in an install from skills.sh. Run the command with `<run>` = `${CLAUDE_SKILL_DIR}/../run`. If the output says `Cannot find module`, do it again with `<run>` = `${CLAUDE_SKILL_DIR}/../e2e-run`. Do not examine the folders first. If a path starts with a `$` variable that has no value, use the folder of this file in its place. If the two paths fail, tell the human to install the `e2e-run` skill from `abdielou/e2e-skill`. Then stop.
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
| Spec | The comparison of `scenario.spec.ts` with `scenario.md`. See the states in `<run>/reference/project-layout.md` |
| Last run | The result that `/e2e:run` wrote on this machine |
| Open findings | The lines with `- [ ]` in `findings.md` |

## About this skill

This section is for a person who reads this file, for example on skills.sh. It is not a step of the procedure.

- **Purpose:** a status table of each feature and each scenario: the state of its test, the last run result, and the open findings. A script calculates it, not a model.
- **Needs:** Node.js 18 or later.
- **Install the set:** `e2e-run`, `e2e-build`, `e2e-explore`, and `e2e-dashboard`. This skill needs the helper script of `e2e-run`.
- **Claude Code:** the plugin install of the same repository adds a hook. The hook asks you before an agent changes an assertion or reads your credentials. This skill alone does not have it.
- **Documentation:** https://github.com/abdielou/e2e-skill#readme
