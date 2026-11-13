# Project Layout

The plugin keeps all files in `e2e-scenarios/` at the project root.

```
e2e-scenarios/
  e2e.config.json           # Base URL and auth mode (commit)
  playwright.config.ts      # Playwright config, created by the helper script (commit)
  seed.spec.ts              # Start state for exploration (commit)
  auth.setup.ts             # Login steps, only in the scripted auth mode (commit)
  COVERAGE.md               # Feature catalog (commit)
  .gitignore                # Ignores the three items below
  .env                      # Credentials and base URL override (never commit)
  .auth/state.json          # Saved session (never commit)
  .results/                 # Run evidence (never commit)
    runs/<area>__<scenario>.json   # Last result of each scenario
    history.jsonl                  # One line for each run
    html/index.html                # Playwright report of the last run
    artifacts/                     # Traces and screenshots of failed tests
  <area>/
    <scenario>/
      scenario.md           # The approved scenario: the contract (commit)
      scenario.spec.ts      # The generated Playwright test (commit)
      findings.md           # Issues found during exploration (commit)
      import-data.csv       # Fixture files of this scenario (commit)
```

## Conventions

- `<area>` is a feature area, for example `deals`. Use lowercase kebab-case.
- `<scenario>` is a flow, for example `creation`. Use lowercase kebab-case.
- The reference to a scenario is `<area>/<scenario>`, for example `/e2e:run deals/creation`.
- Fixture files are in the scenario folder. In a spec, get the folder with `path.dirname(test.info().file)`.

## Settings

`e2e.config.json` has two values:

| Key | Values | Meaning |
|-----|--------|---------|
| `baseURL` | A URL | The address of the application. `E2E_BASE_URL` in the environment or in `.env` replaces it |
| `auth` | `scripted`, `manual`, `none` | How tests get a signed-in session |

## Spec states

The helper script compares each spec with its scenario and gives one state.

| State | Meaning | Next action |
|-------|---------|-------------|
| Scenario only | No spec | `/e2e:run <path>` |
| Spec ready | The spec proves each Expected item of the current scenario | `/e2e:run <path>` |
| Spec stale | `scenario.md` changed after the spec was generated | `/e2e:run <path> --regenerate` |
| Contract gap | A test or an Expected step is missing, or the spec uses a forbidden call | `/e2e:run <path> --regenerate` |
| Spec has no contract | The spec is from plugin version 2 | `/e2e:run <path> --regenerate` |
