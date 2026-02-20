# Run Mode

When `/e2e <area>/<scenario>` is invoked, execute the phases below in order. This mode handles authentication, spec generation (if needed), test execution, and reporting.

---

## Phase -2: Model Profile Check

**Run this phase first** on every invocation (explore, build, or run). Use a simple Bash command to check for the config file — do not read files unnecessarily.

**1. Check if a profile has been chosen:**

```bash
cat e2e-scenarios/.config/model-profile.txt 2>/dev/null
```

**2. If the file exists and contains a valid profile** (`optimized`, `quality`, or `economy`):

- Store the profile name in memory for this session
- Continue to the next phase silently (no output to user)

**3. If the file does NOT exist or is invalid:**

Use **AskUserQuestion** to prompt:

```
No model profile configured. Which profile should the e2e skill use?
```

**Options:**

**Option A: Optimized (Recommended)**
- **Label:** "Optimized (Recommended)"
- **Description:** "Best model for each job — Sonnet scans, Opus authors, Haiku runs existing specs."

**Option B: Quality**
- **Label:** "Quality"
- **Description:** "Opus for everything. Highest quality, highest cost."

**Option C: Economy**
- **Label:** "Economy"
- **Description:** "Sonnet + Haiku only. Lowest cost, still capable."

**4. Save the profile:**

```bash
mkdir -p e2e-scenarios/.config
```

Write the chosen profile (`optimized`, `quality`, or `economy`) to `e2e-scenarios/.config/model-profile.txt`.

**5. Print a model recommendation based on the current mode:**

After the profile is set (either loaded or just chosen), print a tip based on what mode the user invoked:

| Mode invoked | Optimized tip | Quality tip | Economy tip |
|-------------|---------------|-------------|-------------|
| `explore` | "Tip: Sonnet is ideal for this. Run `/model sonnet` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet is ideal for this. Run `/model sonnet` if needed." |
| `build` | "Tip: Opus is ideal for authoring. Run `/model opus` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet handles this well." |
| `run` (new spec) | "Tip: Opus is ideal for spec generation. Run `/model opus` if needed." | "Tip: Opus is used for quality profile." | "Tip: Sonnet handles this well." |
| `run` (existing spec) | "Tip: This just runs an existing spec — Haiku is plenty. Run `/model haiku` if needed." | "Tip: Opus is used for quality profile." | "Tip: This just runs an existing spec — Haiku is plenty. Run `/model haiku` if needed." |
| Dashboard (`/e2e`) | No tip needed (read-only) | No tip needed | No tip needed |

Only print the tip when the profile is **first created**. On subsequent runs where the config already exists, skip the tip to avoid noise.

**6. Model lookup for subagents:**

When spawning Task subagents later in the workflow, use this mapping to set the `model` parameter:

| Subagent context | Optimized | Quality | Economy |
|-----------------|-----------|---------|---------|
| Explore mode — codebase scan (Step 2) | `sonnet` | `opus` | `sonnet` |
| Run mode — Phase 3 codebase research | `sonnet` | `opus` | `sonnet` |
| Run mode — Phase 5.5 spec review | `haiku` | `opus` | `haiku` |

---

## Phase -1: Credential Detection and Setup

**Run this phase** before any other phase (after Phase -2).

**1. Check if a credential method was previously chosen:**

```bash
# Check if method.txt exists
cat e2e-scenarios/.auth/method.txt 2>/dev/null
```

**2. If method.txt exists, use the specified method to check for credentials:**

**If method is "keychain":**

- Check if `keytar` is installed: `npm list keytar 2>/dev/null`
- If installed, retrieve credentials using Node.js:
  ```javascript
  const keytar = require("keytar");
  const creds = await keytar.getPassword("e2e-credentials", "credentials");
  ```
- If found, parse the JSON string `{"username":"...","password":"..."}` and store in memory
- If not found or error, proceed to step 3 (prompt user)

**If method is "env":**

- Check if file exists: `test -f e2e-scenarios/.env`
- If exists, read it and extract `E2E_USERNAME` and `E2E_PASSWORD`
- Store in memory for this run
- If not found, proceed to step 3 (prompt user)

**If method is "manual":**

- No credentials to retrieve
- Set flag in memory: `manualAuthMode = true`
- Skip to Phase 0

**If method.txt does NOT exist (first-time setup):**

- No previous method chosen
- Proceed to step 3 (prompt user)

**3. If NO credentials found OR method.txt doesn't exist, prompt user with AskUserQuestion:**

```
No authentication credentials found. How would you like to handle login?
```

**Options:**

**Option A: System Keychain (Recommended)**

- **Label:** "System Keychain (Most Secure)"
- **Description:** "Your OS encrypts and stores credentials securely. Requires `keytar` package. Fully automated login."

**Option B: Local .env File**

- **Label:** "Local .env File"
- **Description:** "Plain text in e2e-scenarios/.env (gitignored). Fully automated login. Works immediately."

**Option C: Manual Login**

- **Label:** "Manual Login Each Time"
- **Description:** "No credential storage. You'll log in via browser when needed. Most secure (nothing stored)."

**4. Based on user's choice:**

**If Option A (System Keychain):**

1. Check if `keytar` is installed:
   ```bash
   npm list keytar
   ```
2. If NOT installed, tell user:

   ```
   System keychain requires the `keytar` package.

   Install it with:
     npm install -D keytar

   Then run /e2e again.
   ```

   **Stop here** and wait for user to install.

3. If installed, prompt for credentials using **AskUserQuestion** (text inputs for username and password)
4. Store in keychain using Node.js:
   ```javascript
   const keytar = require("keytar");
   const credentials = JSON.stringify({ username: "...", password: "..." });
   await keytar.setPassword("e2e-credentials", "credentials", credentials);
   ```
5. Confirm: "Credentials saved securely in system keychain"
6. Store in memory for this run

**If Option B (Local .env):**

1. **Do NOT prompt for credentials.** Instead, provide instructions:

   ```
   Please create the file `e2e-scenarios/.env` with your credentials:

   1. Create the file (if e2e-scenarios/ doesn't exist, create it first):
      e2e-scenarios/.env

   2. Add these lines (replace with your actual credentials):
      E2E_USERNAME=your.email@example.com
      E2E_PASSWORD=yourpassword

   3. (Optional) To target a different URL than http://localhost:3000, add:
      E2E_BASE_URL=http://localhost:4000

   4. Save the file

   Once created, run /e2e again to continue.
   ```

2. Ensure `e2e-scenarios/.env` is in `.gitignore`:
   - Read `.gitignore`
   - If `e2e-scenarios/.env` not present, add it
3. Create `e2e-scenarios/.auth/method.txt` with content `env`
4. **Stop here** - user needs to create the .env file manually
5. Next time they run `/e2e`, Phase -1 will detect the .env file and load credentials from it

**If Option C (Manual):**

1. Set a flag in memory: `manualAuthMode = true`
2. Confirm: "You'll be prompted to log in via browser when needed"
3. Continue to Phase 0

**5. Store credential method preference:**

Create `e2e-scenarios/.auth/method.txt` with the chosen method (`keychain`, `env`, or `manual`) so future runs know which method to use.

---

## Phase 0: Pre-flight Checks

**1. Resolve the base URL:**

Read `e2e-scenarios/.env` (if it exists) and check for `E2E_BASE_URL`. If defined, use that value. If not defined or the file doesn't exist, default to `http://localhost:3000`. Store this resolved URL in memory — use it for **all** subsequent operations in this run (pre-flight check, browser navigation, error messages).

**2. Verify the app is running:**

```bash
curl -s -o /dev/null -w "%{http_code}" <resolved-base-url>
```

If the app is not reachable, tell the user:

> The app is not running at `<resolved-base-url>`. Please start it first.

**Stop here** until the app is confirmed running.

**3. Ensure Playwright config exists:**

If `e2e-scenarios/playwright.config.ts` does NOT exist, generate it:

```typescript
import { defineConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim();
  }
}

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  retries: 1,
  timeout: 60_000,
});
```

Write it using the **Write** tool.

**4. Resolve scenario path and check for existing test:**

The user provides a scenario reference like `deals/creation` or `contracts/list`. Resolve the full paths:

- Scenario file: `e2e-scenarios/<area>/<name>/scenario.md`
- Spec file: `e2e-scenarios/<area>/<name>/scenario.spec.ts`

If the scenario file doesn't exist at the resolved path, use **Glob** to search `e2e-scenarios/**/scenario.md` for a match. This handles cases where the user provides a partial name.

**If `--regenerate` flag is passed:**

1. Announce: "Regenerating test for scenario..."
2. Delete existing spec if it exists
3. Continue to Phase 1 — **read `modes/run-generate.md`** (relative to the skill's directory) and follow those instructions

**If the spec file EXISTS (and no --regenerate):**

1. Announce: "Found existing test: `e2e-scenarios/<area>/<name>/scenario.spec.ts` - running it now..."
2. **Check for `--headless` flag:**
   - If `--headless` flag is present: Run headless (no visible browser, faster)
     ```bash
     npx playwright test e2e-scenarios/<area>/<name>/scenario.spec.ts --config e2e-scenarios/playwright.config.ts
     ```
   - If `--headless` flag is NOT present: Run with visible browser (default)
     ```bash
     npx playwright test e2e-scenarios/<area>/<name>/scenario.spec.ts --headed --config e2e-scenarios/playwright.config.ts
     ```
   - **IMPORTANT:** Use `--headed` flag ONLY (not `--debug`, not `--ui`)
   - **NEVER** use flags that open the Playwright Inspector (`--debug`, `--headed --debug`, etc.)
3. **Check for authentication failures:**
   - If the test fails with timeout/redirect to a login/SSO page, this indicates expired authentication
   - DO NOT stop here - proceed to Phase 0.5 (Re-authenticate)
4. If test passed or failed for other reasons:
   - Parse the Playwright output and display results using the **Standard Results Table** (see below)
   - **Stop here** - do not proceed to other phases

**If the spec file does NOT exist:**

1. Announce: "No existing test found. I'll explore the scenario and generate one."
2. **Read `modes/run-generate.md`** (relative to the skill's directory) and follow those instructions starting from Phase 1.

---

## Phase 0.5: Re-authenticate (when auth expires during test run)

**When to use:** Test failed with authentication errors (timeout waiting for authenticated page, redirect to login/SSO page).

**Do NOT ask the user to manually delete files.** Instead:

1. **Announce the issue:**

   ```
   The test failed because the saved authentication has expired.
   I'll log you in again automatically...
   ```

2. **Delete the expired auth state:**

   ```bash
   rm e2e-scenarios/.auth/state.json
   ```

3. **Check for stored credentials** (from Phase -1):
   - If credentials are available in memory from Phase -1, use them
   - Otherwise, retrieve them based on the method stored in `e2e-scenarios/.auth/method.txt`:
     - `keychain`: Retrieve from system keychain
     - `env`: Read from `e2e-scenarios/.env`
     - `manual`: No credentials available

4. **Launch browser with Playwright MCP:**
   - Navigate to the resolved base URL (from Phase 0)
   - Take a snapshot of the page

5. **Authenticate based on credential method:**

   **If credentials are available (keychain or env):**
   - Wait for login screen to load
   - Identify login form fields (username/email field, password field, submit button)
   - Use Playwright MCP to:
     ```
     browser_fill_form with username and password
     browser_click on submit/login button
     ```
   - Wait for navigation to authenticated page
   - Take a snapshot to verify authentication succeeded
   - **Save new auth state**: Use Playwright MCP's `browser_run_code` to extract cookies/storage and save to `e2e-scenarios/.auth/state.json` via Write tool

   **If manual mode (no credentials):**
   - Use **AskUserQuestion** to prompt:

     ```
     Authentication Required

     A browser window should now be open showing the login screen.
     Please log in, then confirm below once you see the app (not the login screen).

     After you confirm, I'll save your session and re-run the test automatically.
     ```

   - After user confirms, take snapshot to verify authentication succeeded
   - If still on login screen, repeat the prompt
   - **Save new auth state**

6. **Close the browser:**

   ```
   browser_close
   ```

7. **Re-run the test:**
   - Execute the same test command from Phase 0
   - Parse results and display using the **Standard Results Table**
   - **Stop here** - the test has been re-run with fresh auth

**Important:** With stored credentials, this flow is fully automatic. The user never needs to intervene - the skill handles re-authentication and re-runs the test seamlessly.

---

## Standard Results Table

**All test result reporting** (Phase 0 existing spec runs and Phase 7 generation runs) must use this exact format. Parse the Playwright output and render:

```
### Results

| #  | Test                        | Time   | Result |
|----|-----------------------------|--------|--------|
| 1  | Create a basic record        | 18.3s  | PASS   |
| 2  | Create with all fields       | 15.6s  | PASS   |
| 3  | Edit - change dates          | 11.9s  | FAIL   |

**N passed** · **N failed** · total time
```

Rules:

- `#` is sequential (1, 2, 3...), matching test execution order
- `Test` is the test title from the spec (the string in `test('...')`)
- `Time` is the individual test duration from Playwright output
- `Result` is **PASS** or **FAIL** — nothing else
- Summary line at the bottom with counts and total time
- If any test failed, show the error message below the table:
  ```
  **Failures:**
  - #3 Edit - change dates: Timeout waiting for selector '.save-btn'
  ```

---

## Phase 8: Cleanup

After reporting results, clean up **except auth state**:

1. **Close the browser** using Playwright MCP's `browser_close` tool (if not already closed in Phase 6)
2. **Delete screenshots only** - Remove Playwright MCP artifacts but **preserve auth**:
   ```bash
   rm -rf .playwright-mcp
   ```
3. **NEVER delete** `e2e-scenarios/.auth/state.json` - this preserves login for future runs
4. **Confirm cleanup** - Don't report cleanup to user unless there's an error

**Important**: Keep the browser open while running multiple scenarios. Only close at the very end.
