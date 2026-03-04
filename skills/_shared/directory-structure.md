# Directory Structure

Each scenario is a **folder** containing its scenario file, generated spec, and any fixtures — all colocated.

```
e2e-scenarios/
  .auth/
    state.json              # Saved auth state (cookies/tokens, NOT credentials)
    method.txt              # Credential method: "keychain", "env", or "manual"
  .config/
    model-profile.txt       # Model profile: "optimized", "quality", or "economy"
  .env                      # (Optional) Credentials + base URL config (gitignored)
  COVERAGE.md               # Feature catalog (Feature + Description only, status inferred from filesystem)
  playwright.config.ts      # Playwright config
  <area>/                   # Feature area (e.g., deals/, contracts/)
    <scenario>/             # Scenario folder (e.g., creation/, list/, hourly/)
      scenario.md           # Human-written scenario (input)
      scenario.spec.ts      # Generated Playwright test (output)
      import-data.csv       # (Optional) Fixture files colocated here
      sample-image.png      # (Optional) Any test assets needed by this scenario
```

**Convention:**
- `<area>` = feature area (lowercase, kebab-case)
- `<scenario>` = flow or aspect (lowercase, kebab-case) — this is the scenario's identity
- Every scenario folder always contains `scenario.md`; `scenario.spec.ts` is generated on first run
- Fixture files (CSV, PNG, PDF, etc.) live **inside the scenario folder** alongside the spec
- Shared files (`COVERAGE.md`, `playwright.config.ts`, `.auth/`) stay at the root

**Referencing scenarios:** Users reference scenarios as `<area>/<scenario>` (the folder path):
```
/e2e:run deals/creation
/e2e:run contracts/list
/e2e:build deals/edit
```

**Note:** `e2e-scenarios/.auth/`, `e2e-scenarios/.config/`, and `e2e-scenarios/.env` are gitignored (local preferences and credentials). The `.auth/state.json` contains session tokens. If using the `.env` method, that file contains your credentials in plain text. If using keychain, credentials are stored securely in your OS credential manager.
