---
name: explore
description: Use when the user asks which features have no E2E test, says "explore coverage", "find coverage gaps", "scan for e2e", "what needs testing", or "e2e explore", or invokes /e2e:explore.
---

# E2E Explore

Find the user-facing features of the application and write them to the catalog `e2e-scenarios/COVERAGE.md`. The dashboard compares the catalog with the scenarios on disk.

Read `${CLAUDE_SKILL_DIR}/../run/reference/project-layout.md` first.

That file is in the `run` skill, which is installed next to this skill. If a path starts with a `---
name: explore
description: Use when the user asks which features have no E2E test, says "explore coverage", "find coverage gaps", "scan for e2e", "what needs testing", or "e2e explore", or invokes /e2e:explore.
---

# E2E Explore

Find the user-facing features of the application and write them to the catalog `e2e-scenarios/COVERAGE.md`. The dashboard compares the catalog with the scenarios on disk.

 variable that has no value, use the folder of this file in its place. If the `run` folder is missing, tell the human to install the `run` skill from `abdielou/e2e-skill`. Then stop.

## Procedure

1. **Look for a catalog.** If `e2e-scenarios/COVERAGE.md` exists, show its feature list. Then ask with **AskUserQuestion**:

   | Option | Action |
   |--------|--------|
   | Full rebuild | Scan the full codebase and replace the catalog |
   | Update one area | Ask which area. Scan only that area. Merge the result into the catalog |
   | Cancel | Stop |
2. **Read the scenarios that exist.** Read each `e2e-scenarios/**/scenario.md`. List the flows that they cover.
3. **Scan the code.** Start `e2e:coverage-scanner` subagents, one for each part of the application, in one message so that they run at the same time. Do not run them in the background. Tell each one which folders to scan. If that subagent type does not exist, start general subagents and tell each one to read `${CLAUDE_SKILL_DIR}/scan.md` and follow it. If you cannot start a subagent, read `scan.md` and do the scan yourself. For an update of one area, scan only the routes, components, and handlers of that area.
4. **Merge.** Join the results. Remove duplicates. Give each feature a path `<area>/<scenario>` in lowercase kebab-case. If a scenario folder covers the feature, use the path of that folder.
5. **Write the catalog** in this format:

   ```markdown
   # E2E Coverage Catalog

   > Last updated: <date>
   >
   > This file lists the known features. Run `/e2e:dashboard` for the status of each one.

   | Feature | Description | Path |
   |---------|-------------|------|
   | Order List | List view with filters, sorting, pagination, export | `orders/list` |
   | Order Creation | Wizard with three steps: details, quantities, review | `orders/creation` |
   ```
6. **Report.** Show the table and the next commands:

   ```
   Catalog saved to e2e-scenarios/COVERAGE.md

   To see the status:    /e2e:dashboard
   To write a scenario:  /e2e:build <area>/<scenario>
   ```

## Rules

- **This skill writes `COVERAGE.md` only.** It does not write a scenario or a spec. The human decides what to build.
- **No status, dates, or results in the catalog.** They go out of date. The dashboard reads them from the files.
- **One row for each feature that a user can see.** A backend endpoint with no UI is not a row.
