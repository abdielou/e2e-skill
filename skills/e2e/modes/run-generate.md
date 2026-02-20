# Run Mode — Spec Generation (Phases 1-7)

**This file is loaded when no existing spec is found.** Continue from Phase 0 in `run.md`.

---

## Phase 1: Launch Browser and Check Authentication

**Auth state file**: `e2e-scenarios/.auth/state.json`

1. Check if auth state file exists
2. Use Playwright MCP to navigate to the resolved base URL (from Phase 0)
3. Take a snapshot of the page
4. **Detect authentication state**:
   - Login screen indicators: login forms, "Sign In" buttons, SSO/OAuth page, redirect to `/login`
   - Authenticated indicators: navigation menus, user info, dashboard content

**If authenticated:** Proceed to Phase 2.

**If NOT authenticated:**

5. **Check for stored credentials** (from Phase -1):
   - If credentials are available in memory from Phase -1, use them
   - Otherwise, retrieve them based on the method stored in `e2e-scenarios/.auth/method.txt`:
     - `keychain`: Retrieve from system keychain
     - `env`: Read from `e2e-scenarios/.env`
     - `manual`: No credentials available

6. **Authenticate based on credential method:**

   **If credentials are available (keychain or env):**
   - Announce: "Logging in automatically with stored credentials..."
   - Wait for login screen to load
   - Identify login form fields (username/email field, password field, submit button)
   - Use Playwright MCP to:
     ```
     browser_fill_form with username and password
     browser_click on submit/login button
     ```
   - Wait for navigation to authenticated page
   - Take a snapshot to verify authentication succeeded
   - If login failed (still on login screen or error message), announce the failure and fall back to manual login (see below)
   - **Save auth state**: Ensure the `.auth` directory exists, then use Playwright MCP's `browser_run_code` to extract cookies and storage:
     ```bash
     mkdir -p e2e-scenarios/.auth
     ```
     Then use `browser_run_code` to capture the storage state and write it to `e2e-scenarios/.auth/state.json` via the **Write** tool
   - Proceed to Phase 2

   **If manual mode (no credentials) OR automated login failed:**
   - Display this message:

   ***

   **Authentication Required**

   I've detected a login screen. Please log in manually:
   1. Look for the browser window that just opened
   2. Complete the login process
   3. Once you see the app (not login screen), confirm below

   _After you confirm, I'll save your session so you won't need to log in again._

   ***
   - Use **AskUserQuestion** to wait for confirmation
   - After confirmation, take another snapshot to verify authentication succeeded
   - If still on login screen, repeat the prompt
   - **Save auth state**: Same as above
   - Proceed to Phase 2

**Note**: The auth state contains cookies and localStorage tokens - NOT your password. Even with automated login, actual credentials are never stored in the auth state file.

---

## Phase 2: Parse the Scenarios File

Read `e2e-scenarios/<area>/<name>/scenario.md` and extract (see **Scenario File Format** in skill.md):

- **Context**: Prerequisites, permissions, setup requirements
- **Scenarios**: Each has a Description and Expected outcome

---

## Phase 3: Understand the Application & Build Spec Guide

**Recommended: Run this phase in parallel with Phase 2 using a Task (Explore) subagent.** Launch the subagent as a non-background Task call (do NOT use `run_in_background`) so results return automatically. Background tasks cause stalls where the agent waits for user input instead of continuing.

**Model selection:** Set the subagent's `model` parameter based on the active profile (see Phase -2 model lookup table in `run.md`).

Delegate codebase research to an Explore subagent with a prompt like:

> Research the app for E2E testing of [scenario description]. Find:
>
> 1. Which pages/URLs are involved (check route definitions)
> 2. Form fields and their `data-testid` attributes or accessible names
> 3. Validation rules and error states
> 4. Success indicators (toasts, redirects, confirmation text)
> 5. **Component patterns** — What UI library is used (e.g., MUI DataGrid, MUI Autocomplete)? What's the best Playwright selector strategy for each component type?
> 6. **Loading/async patterns** — What API calls are made on page load or form submit? What loading indicators exist (spinners, skeletons)? What should the spec wait for after actions?
> 7. **Known gotchas** — Any dynamic IDs, portals (dropdowns rendering outside the form), or conditional fields?
>
> Return a **spec guide** with:
>
> - A selector cheat sheet for each page/component
> - Recommended wait strategies (which API responses to wait for, which elements signal "loaded")
> - Environment-specific values that should be extracted as constants

This keeps file contents out of the main context window, preserving it for the browser interaction phases. The spec guide will be used in Phase 5 during generation and Phase 5.5 during review.

**If not using a subagent**, do the research directly:

- Use **Glob** to find relevant page/component files
- Use **Grep** to search for `data-testid`, form labels, and route paths
- Build a mental model of the steps needed

---

## Phase 4: Execute and Record (Clean Steps Only)

Initialize two lists:

- **recorded steps** - for the Playwright spec (clean path only)
- **issues found** - friction, bugs, or workarounds encountered

For each scenario:

1. Announce: "Exploring scenario: [scenario name]"

2. Execute actions step by step:
   - **Navigate through the UI, not the URL bar.** Click sidebar links, menu items, breadcrumbs, and buttons to move between pages — just like a real user would. The only exception is the very first navigation to the app's root URL at the start of exploration.
   - Click, fill forms, select options
   - For "any available option" - pick the first valid option and note what was selected
   - **CRITICAL**: After any click that triggers navigation (e.g., Next, Submit, Save):
     - STOP and wait for the page to change
     - Take a snapshot to confirm you're on the new page/step
     - Only then proceed to the next action
   - Never assume a click worked - always verify the result

3. **Record only successful actions** to the steps list:
   - If you click something and it works → record it
   - If you make a mistake (wrong button, need to go back) → DO NOT record the mistake
   - If you retry an action → only record the successful attempt
   - The recorded steps should be the clean, direct path

4. **Track ALL issues encountered** (even if you work around them):
   - Button needed multiple clicks to respond
   - Unexpected error messages or validation failures
   - Slow loading / timeouts / spinners that took too long
   - Confusing UI flow (had to backtrack or guess)
   - Missing feedback (no loading state, unclear success/error)
   - Elements hard to find or poorly labeled
   - Dropdowns with no options or wrong options
   - Form cleared unexpectedly
   - Any behavior that felt like a bug or UX problem

   For each issue, note:

   ```
   {
     type: 'bug' | 'ux' | 'performance' | 'accessibility',
     severity: 'blocker' | 'major' | 'minor',
     location: string,        // Where it happened (page/component)
     description: string,     // What happened
     workaround: string       // How you got past it (if applicable)
   }
   ```

5. For each recorded step, capture:

   ```
   {
     action: 'click' | 'fill' | 'select' | 'navigate' | 'wait' | 'assert',
     selector: string,        // Best selector (prefer data-testid)
     value?: string,          // For fill/select actions
     description: string,     // Human-readable step description
     waitAfter?: {            // Required for navigation-triggering actions
       type: 'selector' | 'url' | 'text',
       value: string          // What to wait for after this action
     }
   }
   ```

   **Navigation-triggering actions MUST have `waitAfter`** - this includes:
   - Clicking Next/Submit/Save/Continue buttons
   - Clicking links that navigate to new pages
   - Form submissions
   - Any action that changes the visible content significantly

6. Verify the expected outcome is achieved

**If authentication is lost mid-test:**
Pause, ask user to re-authenticate, then continue. Don't record the auth interruption (but DO note it as an issue if it was unexpected).

---

## Phase 5: Generate Playwright Test

**Use the spec guide from Phase 3** (if available) to inform selector choices, wait strategies, and which values to extract as constants.

**Fixtures:** If a scenario requires test files (CSV imports, image uploads, PDF attachments, etc.), generate them and save directly in the scenario folder (`e2e-scenarios/<area>/<name>/`). Reference them via `path.join(__dirname, '<filename>')` in the spec. Keep fixtures minimal — only the data needed to exercise the scenario.

After successfully completing all scenarios, generate `e2e-scenarios/<area>/<name>/scenario.spec.ts`:

```typescript
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * E2E Test: <Scenario Group Name>
 * Generated from: e2e-scenarios/<area>/<name>/scenario.md
 * Generated on: [ISO timestamp]
 *
 * Run: npx playwright test e2e-scenarios/<area>/<name>/scenario.spec.ts --config e2e-scenarios/playwright.config.ts
 * Run headed: npx playwright test e2e-scenarios/<area>/<name>/scenario.spec.ts --headed --config e2e-scenarios/playwright.config.ts
 */

// ---------------------------------------------------------------------------
// Test data — update these values for your environment
// ---------------------------------------------------------------------------
const TEST_ENTITY = "Acme Corp";
const TEST_CATEGORY = "Standard";
// ... add constants for any values that vary by environment

// Load saved auth state if it exists (two levels up from scenario folder)
const authFile = path.join(__dirname, "..", "..", ".auth", "state.json");
const storageState = fs.existsSync(authFile) ? authFile : undefined;

test.describe("<Scenario Group Name>", () => {
  // Run tests serially — they share a single browser session
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState });
    page = await context.newPage();
    // Navigate to the app root — the ONLY page.goto() allowed in the spec
    await page.goto("/");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("<scenario name>", async () => {
    // Navigate to the target page through the app's UI (sidebar, menu, links)
    await page.getByRole("link", { name: "..." }).click();
    await expect(page).toHaveURL(/\/.../);

    // Step 1: [description from recorded step]
    await page.getByTestId("...").click();

    // Step 2: [description]
    await page.getByLabel("...").fill("...");

    // ... more steps ...

    // Verify: [expected outcome]
    await expect(page.getByText("...")).toBeVisible();
  });

  test("<next scenario name>", async () => {
    // Continues in the same browser session
    // Navigate via UI if this scenario starts on a different page
    // await page.getByRole("link", { name: "..." }).click();

    // Steps...

    // Verify: [expected outcome]
    await expect(page.getByText("...")).toBeVisible();
  });
});
```

**Shared session pattern:**

- `test.describe.configure({ mode: 'serial' })` — Tests run in order, not in parallel
- `let page: Page` — A single page instance shared across all tests in the group
- `page.goto("/")` in `beforeAll` is the **only** direct URL navigation allowed — all other navigation must go through UI elements (sidebar links, menu items, breadcrumbs, buttons)
- `beforeAll` — Opens one browser context, navigates to the starting page once
- `afterAll` — Closes the page when the group is done
- Each `test()` receives no `{ page }` fixture — it uses the shared `page` variable
- Only re-navigate (call `page.goto(...)`) inside a test if that scenario starts on a **different page** than where the previous test ended
- If multiple tests interact with the same page (e.g., a list view), skip redundant navigation

**Use relative URLs** in `page.goto()` — the `baseURL` is set in `playwright.config.ts`.

**Selector Priority** (most stable first):

1. `data-testid`: `page.getByTestId('submit-btn')`
2. Role + name: `page.getByRole('button', { name: 'Submit' })`
3. Label: `page.getByLabel('Email')`
4. Placeholder: `page.getByPlaceholder('Enter email')`
5. Text: `page.getByText('Welcome')`
6. CSS (last resort): `page.locator('.btn-primary')`

**Write the file** using the Write tool to `e2e-scenarios/<area>/<name>/scenario.spec.ts`.

---

## Phase 5.5: Review Generated Spec (Quality Gate)

**Spawn a Task (general-purpose) subagent** to review the generated spec with fresh eyes. The main agent's context is saturated with browser snapshots — a fresh agent catches things it won't.

**Model selection:** Set the subagent's `model` parameter based on the active profile (see Phase -2 model lookup table in `run.md`).

Prompt for the review subagent:

> Review the Playwright spec at `e2e-scenarios/<area>/<name>/scenario.spec.ts` against these rules. Read the spec file, then return a list of **concrete fixes** (not suggestions — actual code changes).
>
> **Checklist:**
>
> 1. **Constants block** — Are ALL environment-specific values (entity names, types, hubs, dates, etc.) extracted into named constants at the top? Flag any string literals in test bodies that should be constants.
> 2. **No `waitForTimeout`** — Flag every instance. Suggest a specific replacement (assertion wait, `waitForURL`, `waitForLoadState`, `waitForResponse`).
> 3. **Navigation waits** — After every click that triggers navigation (Next, Submit, Save, link clicks), is there an assertion or `waitForURL` confirming the page changed? Flag any missing ones.
> 4. **Selector quality** — Are selectors using the priority order: `data-testid` > role+name > label > placeholder > text > CSS? Flag any that skip to CSS unnecessarily.
> 5. **Assertions are meaningful** — Does each test actually verify the expected outcome from the scenario, or does it just check elements exist? Flag weak assertions (e.g., `toBeVisible()` on a generic element instead of checking specific content).
> 6. **Shared session** — Tests share a page via `beforeAll`. Verify the pattern is correct: `test.describe.configure({ mode: 'serial' })`, shared `page` variable, `beforeAll`/`afterAll` lifecycle, and no `{ page }` destructuring in individual tests. Flag any test that creates its own page or context.
> 7. **No direct URL navigation** — The only `page.goto()` allowed is `page.goto("/")` in `beforeAll`. All other navigation must use UI elements (sidebar links, menu clicks, breadcrumbs). Flag any `page.goto('/some/path')` inside individual tests — replace with the equivalent UI click sequence.
> 8. **Dead code** — Variables captured but never asserted on, unnecessary `innerText()` calls, unreachable code.
>
> Return format:
>
> ```
> ## Fixes Required
> 1. [file:line] Issue description → Fix: `replacement code`
> 2. ...
>
> ## Looks Good
> - [Brief note on what's done well]
> ```

After receiving the review:

1. Apply all fixes from the "Fixes Required" list
2. If no fixes are needed, proceed directly to Phase 6

---

## Phase 6: Validate Generated Spec

Before reporting success, **run the generated spec to verify it works**:

1. **Close the exploration browser** using Playwright MCP's `browser_close` — the test runner will launch its own
2. **Run the spec headless** (faster validation):
   ```bash
   npx playwright test e2e-scenarios/<area>/<name>/scenario.spec.ts --config e2e-scenarios/playwright.config.ts
   ```
   - **IMPORTANT:** Do NOT use `--debug`, `--ui`, or any flags that open the Playwright Inspector
   - Run headless for validation (no `--headed` flag needed here)
3. **Check the result**:
   - If **PASSED**: Proceed to Phase 7 (Report)
   - If **FAILED**: Analyze the error and fix the spec

**If the spec fails:**

1. Read the error message carefully
2. Identify which step failed and why
3. Fix the issue in the spec file (wrong selector, missing wait, etc.)
4. Re-run the test
5. **Max 3 fix attempts.** If the spec still fails after 3 rounds of fixes, proceed to Phase 7 and report the failure with error details. Let the user decide how to proceed.

**Common fixes:**

- Add missing `await expect(...).toBeVisible()` waits
- Fix selectors that changed between exploration and replay
- Increase timeouts for slow operations
- Handle dynamic content (dates, IDs) with flexible matchers

---

## Phase 7: Report Results

Display results using the **Standard Results Table** (defined in `run.md`).

After generation, also include the exploration issues section.

```
## Test Generation Complete

**Scenario**: e2e-scenarios/<area>/<name>/scenario.md
**Generated**: e2e-scenarios/<area>/<name>/scenario.spec.ts

### Results

| #  | Test                        | Time   | Result |
|----|-----------------------------|--------|--------|
| 1  | Create a basic record        | 18.3s  | PASS   |
| 2  | Create with all fields       | 15.6s  | PASS   |
| 3  | Edit - change dates          | 11.9s  | FAIL   |

**10 passed** · **0 failed** · 2.2 minutes

---

### Issues Found During Exploration

> These issues were encountered during test generation. Even though the test was generated successfully, these may indicate bugs or UX problems that should be addressed.

#### Blockers (0)
[None, or list any blocking issues]

#### Major Issues (N)
| Location | Type | Description | Workaround Used |
|----------|------|-------------|-----------------|
| Form > Category dropdown | bug | Dropdown showed no options on first open | Clicked away and reopened |

#### Minor Issues (N)
| Location | Type | Description |
|----------|------|-------------|
| Create button | ux | No loading indicator after click |

---
### Next time:
  /e2e <area>/<name>    (runs the existing spec)
```

**Important**: Always include the Issues section, even if empty. This gives the user confidence that exploration was thorough. If issues were found, they represent valuable QA feedback beyond just the generated test.

After reporting, proceed to **Phase 8: Cleanup** (in `run.md`).
