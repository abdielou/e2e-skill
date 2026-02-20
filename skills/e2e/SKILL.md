# E2E Testing

Discover coverage gaps, author human-readable scenarios, and generate/run Playwright tests.

## Usage

```
/e2e                                # Dashboard: coverage + scenario status
/e2e explore                        # Scan codebase for coverage gaps
/e2e build <topic>                  # Author scenario .md interactively
/e2e build --ticket 1234            # Build scenario from a work item
/e2e <area>/<scenario>              # Run spec (generate on first run)
/e2e <area>/<scenario> --regenerate # Force spec regeneration
/e2e <area>/<scenario> --headless   # Run headless (no visible browser)
```

Examples:

```
/e2e                                # Shows coverage table + available scenarios
/e2e explore                        # "You're missing settings, user mgmt, ..."
/e2e build settings/preferences     # Asks questions → writes settings/preferences.md
/e2e build --ticket 1234            # Build scenario from a specific ticket
/e2e deals/creation                 # Runs existing spec, or generates if none exists
/e2e contracts/list --regenerate    # Forces regeneration even if spec exists
/e2e deals/edit --headless          # Run headless (faster, no visible browser)
```

**First-time setup:** On your first run of `/e2e <scenario>`, you'll be prompted to choose how to handle authentication:

- **System Keychain** (most secure, requires `keytar` package)
- **Local .env file** (plain text, gitignored)
- **Manual login** (no storage, log in each time)

After initial setup, authentication is handled automatically based on your choice.

## How It Works

```
Codebase (routes, pages, components)
         ↓
    [/e2e explore: scan & compare]
         ↓
Gap Report → COVERAGE.md
         ↓
    [/e2e build: ask questions & write]
         ↓
e2e-scenarios/<area>/<name>/scenario.md          # Human-readable scenario
         ↓
    [/e2e <area>/<name>: first run — AI explores, records, generates]
         ↓
e2e-scenarios/<area>/<name>/scenario.spec.ts     # Playwright test
         ↓
    [/e2e <area>/<name>: future runs — just executes the spec]
```

## Directory Structure

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
/e2e deals/creation
/e2e contracts/list
/e2e build deals/edit
```

**Note:** `e2e-scenarios/.auth/`, `e2e-scenarios/.config/`, and `e2e-scenarios/.env` are gitignored (local preferences and credentials). The `.auth/state.json` contains session tokens. If using the `.env` method, that file contains your credentials in plain text. If using keychain, credentials are stored securely in your OS credential manager.

## Scenario File Format

All `.md` scenario files follow this format:

```markdown
# <Title>

<One-line description of what this scenario group covers.>

Covers: #<ticket>, #<ticket>, ...

## Context

- User must be authenticated
- <Any prerequisites specific to this scenario group>
- Navigate to <starting location>

---

## Scenario: <Descriptive name>

### Description

<2-4 sentences describing what to do. Written in plain English, goal-oriented.
Use phrases like "Create a new...", "Open an existing...", "Navigate to...".
Mention specific field values only when they matter for the test.
Use "any available option" when the specific choice doesn't matter.>

### Expected

1. <Concrete, verifiable outcome>
2. <Another verifiable outcome>
3. <...>

---
```

**Scenario writing rules:**
1. **Goal-oriented, not step-by-step** — Describe *what* to accomplish, not *how* to click through it
2. **Human-readable** — A QA tester who knows the app should understand it without code knowledge
3. **Specific when it matters** — If a bug was about negative quantities, say "enter a negative value"
4. **Generic when it doesn't** — "Select any available option" instead of hardcoding a specific entity name
5. **Verifiable expectations** — Each expected outcome should be something you can see on screen
6. **No implementation details** — No selectors, no CSS classes, no API endpoints, no component names
7. **Atomic scenarios** — Each scenario tests one flow; multiple related flows go in one file

## Managing Credentials

**To update credentials:**

- **Keychain method:** Delete credentials and re-run:
  ```bash
  # Use your OS credential manager to delete "e2e-credentials" entry, or:
  rm e2e-scenarios/.auth/method.txt
  /e2e <scenario>  # Will prompt for new credentials
  ```
- **Env method:** Edit `e2e-scenarios/.env` directly
- **Manual method:** No credentials stored

**To switch credential methods:**

```bash
# Delete current method and state
rm e2e-scenarios/.auth/method.txt
rm e2e-scenarios/.auth/state.json
rm e2e-scenarios/.env  # If using env method

# Run any test - you'll be prompted to choose a new method
/e2e <scenario>
```

**To delete all auth data:**

```bash
rm -rf e2e-scenarios/.auth
rm e2e-scenarios/.env
```

## Prerequisites

- **Playwright MCP** must be configured (for test generation)
- **Playwright** installed: `npm install -D @playwright/test`

**Optional (for automated login):**

- **System Keychain:** `npm install -D keytar` (for secure credential storage)
- **OR Local .env:** No additional dependencies (credentials stored in plain text, gitignored)
- **OR Manual Login:** No credential storage (you'll log in via browser each time)

## Tools

**Required:**

- `Playwright MCP` — `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_select_option`, `browser_run_code`, `browser_close`, `browser_take_screenshot`, `browser_wait_for`, `browser_press_key` *(run mode only)*
- `Read` — Read scenario files, source code, selectors *(all modes)*
- `Write` — Write `.md` scenarios, `.spec.ts` tests, config *(build + run modes)*
- `Bash` — Run `npx playwright test`, pre-flight checks *(run mode)*
- `AskUserQuestion` — Gather requirements, confirm drafts, manual auth *(all modes)*
- `Glob` — Find page files, route definitions, existing scenarios *(all modes)*
- `Grep` — Search for routes, components, `data-testid`, form fields *(explore + run modes)*

**Optional (for efficiency):**

- `Task` (Explore subagent) — Parallelize codebase scanning (explore mode) and research selectors/routes (run mode Phase 3) without bloating the main context window

---

## Model Profiles

The e2e skill uses a **model profile** to control which AI model is used for subagent tasks (codebase scanning, spec review, etc.). The profile is stored in `e2e-scenarios/.config/model-profile.txt`.

### Available Profiles

| Mode | Optimized | Quality | Economy |
|------|-----------|---------|---------|
| Explore (subagents) | sonnet | opus | sonnet |
| Build (main agent) | opus | opus | sonnet |
| Run — new spec (main + subagents) | opus | opus | sonnet |
| Run — existing spec (main agent) | haiku | opus | haiku |

- **Optimized** — Best model for each job. Sonnet scans, Opus authors, Haiku runs existing specs. Good balance of quality and cost.
- **Quality** — Opus for everything. Highest quality, highest cost.
- **Economy** — Sonnet + Haiku. Lowest cost, still capable.

### What the profile controls

- **Subagent models** (directly controlled): When spawning Task subagents (Explore for codebase scanning, general-purpose for spec review), the agent sets the `model` parameter based on the active profile.
- **Main agent model** (advisory): The main agent's model is set at the session level by the user. The profile prints a recommendation so the user knows which model to set (e.g., "Tip: set your session model to haiku for running existing specs").

---

## Instructions for the AI Agent

**Step 1: Run Phase -2 (Model Profile Check).** Read `modes/run.md` (relative to this skill's directory) and execute only the "Phase -2: Model Profile Check" section. This applies to ALL modes (dashboard, explore, build, run). Skip this for the dashboard (`/e2e` with no args).

**Step 2: Load mode-specific instructions.** Based on the subcommand, use the **Read** tool to load the appropriate mode file (all paths relative to this skill's directory), then follow those instructions:

| Subcommand | File to Read |
|------------|-------------|
| `/e2e` (no args) | `modes/dashboard.md` |
| `/e2e explore` | `modes/explore.md` |
| `/e2e build <topic>` | `modes/build.md` |
| `/e2e <area>/<scenario>` | `modes/run.md` (full file — includes auth, pre-flight, and existing spec handling) |

**Run mode note:** If the spec file does NOT exist (or `--regenerate` is passed), `run.md` will instruct you to also read `modes/run-generate.md` for the generation phases.

The **Scenario File Format** and **Rules** sections in this file apply to all modes.

---

## Rules

### General

1. **NEVER capture or log credentials** — Strictly prohibited
2. **NEVER start the application** — This skill assumes the app is already running. If the app is not reachable at `localhost`, tell the user to start it and **stop**. Do not run `npm run dev`, `dotnet run`, `docker-compose up`, or any other command to launch the application.
3. **NEVER create Node.js project artifacts in `e2e-scenarios/`** — Do not create `package.json`, `tsconfig.json`, `package-lock.json`, or install `node_modules` inside `e2e-scenarios/`. Specs run via `npx playwright test` which uses the root project's Playwright and TypeScript setup. If a spec has type errors, fix the spec — do not scaffold a separate Node project to work around it.
4. **Link tickets when known** — Always include `Covers: #<ticket>` when the scenario traces to a work item

### Explore + Build Modes

5. **Explore only writes `COVERAGE.md`** — It catalogs and reports gaps but does not create scenario files. The user decides what to build.
6. **Build never writes `.spec.ts` files** — Build mode only produces `.md` scenario files. Run mode handles spec generation.
7. **Build always confirms before writing** — Show the draft, get approval, then write.
8. **Respect existing coverage** — Don't suggest scenarios that duplicate what's already covered. If adding to an existing file, read it first.
9. **Scenarios must follow the format** — All `.md` files must match the **Scenario File Format** section above.

### Run Mode

10. **Handle auth gracefully** — Detect login screens and authenticate automatically (or ask user for manual auth)
11. **Record only clean steps** — Mistakes and retries should not appear in the generated spec
12. **Prefer stable selectors** — Use `data-testid` whenever available. Follow the selector priority order.
13. **Use the codebase** — Read source files to find the best selectors before interacting
14. **Be descriptive** — Each step in the spec should have a comment explaining what it does
15. **Handle dynamic data** — Use `.first()` for "any available" selections; note the pattern, not the specific value
16. **Extract test data as constants** — Place all environment-specific values (entity names, categories, dropdown options, etc.) in a clearly labeled constants block at the top of the spec file. Never inline these values in test steps. This lets QA testers reconfigure tests for different environments by editing one block.
17. **Navigate through the UI, not URLs** — The only `page.goto()` allowed is `page.goto("/")` in `beforeAll` to enter the app. All other navigation must use the app's own UI: sidebar links, menu items, breadcrumbs, buttons, etc. This tests real user navigation paths and catches broken links, missing menu items, and routing issues that URL-based navigation would skip.
18. **Fixtures are colocated** — When a test needs file uploads or imports (CSV, PNG, PDF, etc.), generate the fixture file and save it in the same scenario folder as the spec. Reference fixtures via `path.join(__dirname, '<filename>')`. Keep fixtures minimal and deterministic.
19. **Avoid `waitForTimeout`** — Never use `page.waitForTimeout()` for waiting on data loads or navigation. Instead use assertion-based waits (`await expect(locator).toBeVisible()`), `waitForURL()`, `waitForLoadState('networkidle')`, or `waitForResponse()`. Fixed timeouts are either too slow or too flaky.
20. **CRITICAL: Verify navigation before proceeding** — After ANY action that triggers navigation or page transition:

    - Wait for a unique element on the NEW page/step to appear before continuing
    - Never click the same button twice without confirming the first click succeeded
    - For wizards: wait for the step indicator to change, or a unique element of the next step
    - Use `waitForSelector`, `waitForURL`, or assertions like `expect(locator).toBeVisible()` in the generated spec

    **Example - BAD (no wait):**

    ```typescript
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // May click same button twice!
    ```

    **Example - GOOD (wait for navigation):**

    ```typescript
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2: Details")).toBeVisible(); // Confirm we're on step 2
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 3: Review")).toBeVisible(); // Confirm we're on step 3
    ```

21. **NEVER use Playwright Inspector or debugging tools** — Do NOT:
    - Use `--debug`, `--ui`, or `--headed --debug` flags when running tests
    - Add `page.pause()` to generated test code
    - Open the Playwright Inspector manually
    - Use any debugging or inspection tools during test execution
    - **Exploration (Phase 4):** Use **Playwright MCP tools only** (browser_navigate, browser_click, etc.)
    - **Running tests (Phase 0, 6):** Use **`npx playwright test`** with `--headed` for visibility OR headless for speed, but NEVER with `--debug`

## Limitations

- Defaults to `http://localhost:3000`. Set `E2E_BASE_URL` in `e2e-scenarios/.env` to target a different URL.
- Auth state may expire — with stored credentials, re-authentication happens automatically; with manual mode, you'll be prompted to log in again
- Generated specs are a starting point — complex flows may need manual tuning
- Dynamic data (IDs, timestamps) uses flexible matchers but may still cause flaky tests
- Max 3 fix attempts during validation — after that, manual intervention is needed
- Automated login requires consistent login form structure (standard email/password fields)
