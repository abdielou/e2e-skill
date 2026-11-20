---
name: run
description: Use when the user asks to run, generate, regenerate, or repair the Playwright E2E test of a scenario, to make a failing E2E test pass, or to set up the login for E2E tests. Use before each change to a file in an e2e-scenarios folder, such as scenario.spec.ts or auth.setup.ts. Use when the user says "run e2e", "e2e run", "generate spec", or "why does the e2e test fail", or invokes /e2e:run with a scenario path such as deals/creation.
argument-hint: "<area>/<scenario> [--regenerate] [--headless]"
---

# E2E Run

Run the spec of one scenario. Generate the spec when it is missing or when it does not match the scenario. Find the cause of each failure before you change a file.

Request: `$ARGUMENTS`

```
/e2e:run <area>/<scenario>                # Run the spec. Generate it first if necessary
/e2e:run <area>/<scenario> --regenerate   # Generate the spec again, then run it
/e2e:run <area>/<scenario> --headless     # Run with no visible browser
```

## Tools

| Name in this skill | Command |
|--------------------|---------|
| `e2e` | `node "${CLAUDE_SKILL_DIR}/scripts/e2e.mjs"` |
| Browser CLI | `npx playwright cli` |

Run each command from the project root. If a path starts with a `$` variable that has no value, use the folder of this file in its place.

**Do not install a browser.** Do not run `npx playwright install`, with or without a browser name. If a command says that a browser executable is missing, tell the human to run `npx playwright install chromium`. Then stop. The install can remove browser builds that other projects use.

**Read `${CLAUDE_SKILL_DIR}/reference/contract.md` first.** Its rules apply to each step below.

## Procedure

1. **Preflight.** Run `e2e preflight`.
   - If a project file, the credentials, or the auth state is missing, read `${CLAUDE_SKILL_DIR}/setup.md` and do the setup.
   - If the application does not answer, tell the human to start it. Then stop.
2. **Find the scenario.** The file is `e2e-scenarios/<area>/<scenario>/scenario.md`.
   - If the path does not exist, search `e2e-scenarios/**/scenario.md` for a match.
   - If there is no scenario, tell the human to write it with `/e2e:build`. Then stop.
3. **Check the contract.** Run `e2e check <area>/<scenario>`.

   | Result of the check | Action |
   |---------------------|--------|
   | No spec | Generate |
   | Spec is stale | Tell the human that the scenario changed. Generate |
   | Spec does not match the scenario, or has no contract header | Tell the human what the check found. Generate |
   | Spec matches the scenario | Go to step 4 |

   If the request has `--regenerate`, generate.
   To generate, read `${CLAUDE_SKILL_DIR}/generate.md` and follow it. It ends with a run and a report, thus go to step 6 after it.
4. **Run.** Run `e2e run <area>/<scenario> --headed`. Omit `--headed` if the request has `--headless`, or if the machine has no display.
5. **Show the result.** Print the output of the run command without changes.
6. **Triage.** If a test failed or did not run, read `${CLAUDE_SKILL_DIR}/triage.md` and follow it.
7. **Clean up.** Run `npx playwright cli close-all` if you opened a browser session. Delete the `.playwright-cli/` folder if this session created it. Do not delete `.auth/` or `.results/`.

## What the run command gives

- A table with one row for each scenario. The `Expected` column shows how many Expected items passed.
- For each failure: the Expected item that failed, or the action that failed, and the path of the trace.
- A notice if the assertions changed after the previous run. Then show the output of `e2e map <area>/<scenario>` to the human.
- A notice for each skipped test. Tell the human about each one.

The command also writes the result to `e2e-scenarios/.results/`. The dashboard reads it.
