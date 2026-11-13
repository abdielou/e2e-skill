# E2E Testing Skill

A Claude Code plugin that keeps a human in control of E2E testing while agents do the work.

- **The human approves scenarios** in plain language. A scenario is the contract.
- **Agents generate, run, and repair** the Playwright tests that prove each scenario.
- **A script checks the contract.** It finds a test that proves less than the scenario, a scenario that changed, and a test that was skipped.
- **Each run leaves evidence** on disk: a result for each expected item, a report, and a trace for each failure.

## Prerequisites

- **Node.js** 18 or later. Your Playwright version can require a later one.
- **Playwright Test** 1.59 or later in your project. It includes the browser CLI that the agents use.

  ```bash
  npm install -D @playwright/test
  npx playwright install chromium
  ```
- **Google Chrome** on the machine. The browser CLI opens it for the first login setup and for a manual login.
- Your application, running. The plugin does not start it.

## Installation

In Claude Code:

```bash
/plugin marketplace add abdielou/e2e-skill
/plugin install e2e@abdielou-e2e-skill
```

Or open `/plugin`, add `abdielou/e2e-skill` on the **Marketplaces** tab, and install `e2e` from the **Discover** tab.

To update:

```bash
/plugin update e2e@abdielou-e2e-skill
```

## Usage

```
/e2e:dashboard                              # Status of each feature and each scenario
/e2e:explore                                # Find features that have no scenario
/e2e:build <topic>                          # Write a scenario with the agent
/e2e:build --ticket 1234                    # Write a scenario from a work item
/e2e:run <area>/<scenario>                  # Run the spec. Generate it first if necessary
/e2e:run <area>/<scenario> --regenerate     # Generate the spec again
/e2e:run <area>/<scenario> --headless       # Run with no visible browser
```

## How It Works

```
Codebase
   |  /e2e:explore            the agent scans, you read the catalog
   v
COVERAGE.md
   |  /e2e:build              the agent drafts, YOU APPROVE
   v
scenario.md                   the contract, in plain language
   |  /e2e:run                the agent explores the application and writes the test
   v
scenario.spec.ts              one test for each scenario, one step for each expected item
   |  /e2e:run                the script runs the test and writes the evidence
   v
Results + assertion map       you review what each test proves
```

### The scenario is the contract

`e2e-scenarios/auth/login/scenario.md`:

```markdown
# Login Flow

Standard authentication flow for the application.

Covers: #1024

## Context

- User must NOT be authenticated

---

## Scenario: Failed login with wrong password

### Description

Enter a valid email but an incorrect password. The form should show
an error without clearing the email field.

### Expected

1. Stays on /login
2. Error message "Invalid credentials" is visible
3. Email field retains the entered value
```

The generated test has one named step for each `Expected` item:

```typescript
// scenario: e2e-scenarios/auth/login/scenario.md
// scenario-sha256: cccee98f70c2...
test("Failed login with wrong password", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(WRONG_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await test.step("E1: Stays on /login", async () => {
    await expect(page).toHaveURL(/\/login$/);
  });
  await test.step('E2: Error message "Invalid credentials" is visible', async () => {
    await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
  });
  await test.step("E3: Email field retains the entered value", async () => {
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(EMAIL);
  });
});
```

### What you review

You do not need to read the test code. A run gives you two tables.

The results, with a count of expected items for each scenario:

```
| # | Scenario                         | Expected | Time | Result |
|---|----------------------------------|----------|------|--------|
| 1 | Failed login with wrong password | 1/3      | 1.8s | FAIL   |

Failures
- #1 Failed login with wrong password
  - E2 Error message "Invalid credentials" is visible: Expected: "Invalid credentials" ...
  - Trace: npx playwright show-trace "e2e-scenarios/.results/artifacts/.../trace.zip"
```

The assertion map, which shows how the test proves each item:

```
| Scenario                         | ID | Expected                                       | Assertions                                                              |
|----------------------------------|----|------------------------------------------------|-------------------------------------------------------------------------|
| Failed login with wrong password | E2 | Error message "Invalid credentials" is visible | await expect(page.getByRole("alert")).toHaveText("Invalid credentials"); |
```

### What the agent cannot do without you

| Action | Rule |
|--------|------|
| Change `scenario.md` | Only in `/e2e:build`, after you approve the draft |
| Change an assertion of an expected item | Only after you approve the change, shown before and after |
| Skip a test | Only on your decision |
| Make a failing test pass when the application does not do what the scenario says | Never. The agent reports it and asks: defect or intended change? |
| Read your credentials | Only if you approve it. No step of the plugin needs it |

A hook enforces three of these rows in each session, also when no skill is loaded: the assertion change, the skipped test, and the credentials. Before an edit changes an assertion of an expected item, or skips a test, Claude Code stops and shows you the change:

```
e2e contract: this edit changes what the test of auth/login proves, and scenario.md did not change.
- "Failed login with wrong password" E2
    before: await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
    after:  await expect(page.getByRole("alert")).toHaveText("Wrong password");
```

The hook is silent for an edit to actions, for a spec whose scenario changed, and for a new spec. A spec is new until it has a run result or until git tracks it.

The hook also asks you before an agent reads `e2e-scenarios/.env` or `e2e-scenarios/.auth/state.json` with the Read tool. It does not cover a search with the Grep tool or a shell command. For those, the rule is in the skill and in the files that the plugin creates.

The script detects these conditions without a model:

| Condition | Where you see it |
|-----------|------------------|
| `scenario.md` changed after the test was generated | Dashboard: `Spec stale` |
| A scenario or an expected item has no test step, or a step has no assertion | Dashboard: `Contract gap` |
| An assertion changed after the previous run | A notice in the run result |
| A test is skipped | Dashboard and run result |
| A fixed wait, `networkidle`, `test.only`, or `page.pause()` in a test | Dashboard: `Contract gap` |

## Authentication

You select one mode in the first run. In each mode, no step puts your password into the conversation.

| Mode | Use it when | How it works |
|------|-------------|--------------|
| `scripted` | The login is a form | You put `E2E_USERNAME` and `E2E_PASSWORD` in `e2e-scenarios/.env`. A Playwright setup test logs in before each run |
| `manual` | SSO, MFA, or CAPTCHA | You log in one time in a browser window. The session is saved and used again until it expires |
| `none` | No login | No auth step |

## Run in CI

The generated tests are plain Playwright tests. CI needs no agent.

```yaml
- run: npm ci && npx playwright install --with-deps chromium
- run: npx playwright test --config e2e-scenarios/playwright.config.ts --project=e2e
  env:
    E2E_BASE_URL: ${{ vars.E2E_BASE_URL }}
    E2E_USERNAME: ${{ secrets.E2E_USERNAME }}
    E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
```

The report is in `e2e-scenarios/.results/html/`. The `manual` auth mode does not work in CI.

To fail a build on a contract gap, copy `scripts/e2e.mjs` from this plugin into your repository and run `node e2e.mjs check`. The file has no dependencies.

## Files in Your Project

```
e2e-scenarios/
  e2e.config.json           # Base URL and auth mode
  playwright.config.ts      # Created by the plugin
  seed.spec.ts              # Start state for exploration
  auth.setup.ts             # Login steps (scripted auth mode)
  COVERAGE.md               # Feature catalog
  .env                      # Credentials (ignored by git)
  .auth/                    # Saved session (ignored by git)
  .results/                 # Run evidence (ignored by git)
  <area>/<scenario>/
    scenario.md             # The approved scenario
    scenario.spec.ts        # The generated test
    findings.md             # Issues that the agent found in the application
```

## Models

The two subagents use Sonnet: `spec-reviewer` and `coverage-scanner`. To use a different model, copy the file from `agents/` to `.claude/agents/` in your project and change its `model` line.

## Migrating from v2 to v3

The commands have the same names. The engine and the auth flow are new.

| v2 | v3 |
|----|----|
| `agent-browser` or Playwright MCP for exploration | The Playwright CLI that is part of `@playwright/test`. No other install |
| Model profiles in `.config/model-profile.txt` | Removed. Delete the `.config/` folder |
| Credentials in the system keychain (`keytar`) or read from `.env` by the agent | A setup test reads `.env`. The agent does not. Delete the `e2e-credentials` keychain entry and `.auth/method.txt` |
| One shared page for all tests of a file | One page for each test |
| `playwright.config.ts` from v2 | `/e2e:run` tells you to replace it. The old file is kept as a backup |
| Specs from v2 | They still run. The dashboard shows `Spec has no contract`. Generate each one again with `--regenerate` |
| `COVERAGE.md` with two columns | Still read. `/e2e:explore` adds the `Path` column |

Your `scenario.md` files need no change.

## Development

```bash
claude --plugin-dir .                 # Load the plugin from this folder
claude plugin validate .              # Check the manifest and the layout
node --test tests/e2e.test.mjs        # Unit tests of the helper script
claude plugin eval . --no-publish     # Behavior tests against a no-plugin baseline
```

The eval cases are in `evals/`. Each eval run calls the model and uses your plan or your API account.

## License

MIT
