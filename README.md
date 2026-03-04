# E2E Testing Skill

Discover coverage gaps, author human-readable scenarios, and generate/run Playwright E2E tests — powered by any MCP-capable agent with [@anthropic-ai/playwright-mcp](https://github.com/anthropics/playwright-mcp).

## Prerequisites

- **MCP-capable agent** with Playwright MCP configured:
  ```bash
  claude mcp add playwright -- npx @anthropic-ai/playwright-mcp@latest
  ```
- **Playwright** installed in your project:
  ```bash
  npm install -D @playwright/test
  ```
- Your application running locally (the skill never starts the app for you)

### Optional (for automated login)

| Method          | Install                 | Notes                        |
| --------------- | ----------------------- | ---------------------------- |
| System Keychain | `npm install -D keytar` | Most secure, OS-encrypted    |
| Local .env      | Nothing extra           | Plain text, gitignored       |
| Manual          | Nothing extra           | Log in via browser each time |

## Installation

### As a plugin (recommended)

**Option A — Interactive UI:**

```bash
/plugin
```

Go to the **Marketplaces** tab, add `abdielou/e2e-skill`, then switch to **Discover** and install `e2e`.

**Option B — CLI:**

```bash
/plugin marketplace add abdielou/e2e-skill
/plugin install e2e@abdielou-e2e-skill
```

### Manual install

Clone directly into your Claude skills directory:

```bash
# User-level (available in all projects)
git clone https://github.com/abdielou/e2e-skill.git ~/.claude/skills/e2e-skill

# Or project-level
git clone https://github.com/abdielou/e2e-skill.git .claude/skills/e2e-skill
```

### Local development

Test the plugin without installing:

```bash
claude --plugin-dir ./path/to/e2e-skill
```

## Usage

```
/e2e:dashboard                              # Coverage + scenario status
/e2e:explore                                # Scan codebase for coverage gaps
/e2e:build <topic>                          # Author scenario .md interactively
/e2e:build --ticket 1234                    # Build scenario from a work item
/e2e:run <area>/<scenario>                  # Run spec (generate on first run)
/e2e:run <area>/<scenario> --regenerate     # Force spec regeneration
/e2e:run <area>/<scenario> --headless       # Run headless (no visible browser)
```

## How It Works

The central artifact is the **scenario file** — a plain-English `.md` that describes what to test. You can author scenarios manually, or let the agent handle the full pipeline: explore your app, build scenarios, generate Playwright specs, and run them.

```
Codebase (routes, pages, components)
         |
    [/e2e:explore — scan & compare]
         |
Gap Report -> COVERAGE.md
         |
    [/e2e:build — ask questions & write]
         |
e2e-scenarios/<area>/<name>/scenario.md          # Human-readable scenario
         |
    [/e2e:run — first run: AI explores, records, generates]
         |
e2e-scenarios/<area>/<name>/scenario.spec.ts     # Playwright test
         |
    [/e2e:run — future runs: just executes the spec]
```

### Example scenario file

`e2e-scenarios/auth/login/scenario.md`:

```markdown
# Login Flow

Standard authentication flow for the application.

Covers: #1024, #1031

## Context

- User must NOT be authenticated
- Navigate to /login

---

## Scenario: Successful login with valid credentials

### Description

Enter valid credentials and submit the login form. The user should be
redirected to the dashboard with their name visible in the header.

### Expected

1. Redirects to /dashboard
2. User's display name appears in the header
3. Navigation menu shows authenticated options

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

### Directory structure (in your project)

```
e2e-scenarios/
  .auth/                        # Auth state (gitignored)
  .config/                      # Model profile (gitignored)
  .env                          # Credentials + base URL (gitignored)
  COVERAGE.md                   # Feature catalog
  playwright.config.ts           # Playwright config
  <area>/
    <scenario>/
      scenario.md               # Human-written scenario (input)
      scenario.spec.ts           # Generated Playwright test (output)
      *.csv, *.png               # Colocated fixtures
```

## Model Profiles

Control cost vs quality for AI subagents:

| Profile       | Explore | Build  | Run (new) | Run (existing) |
| ------------- | ------- | ------ | --------- | -------------- |
| **Optimized** | Sonnet  | Opus   | Opus      | Haiku          |
| **Quality**   | Opus    | Opus   | Opus      | Opus           |
| **Economy**   | Sonnet  | Sonnet | Sonnet    | Haiku          |

Set on first run, or reset by deleting `e2e-scenarios/.config/model-profile.txt`.

## Updating

```bash
/plugin update e2e@abdielou-e2e-skill
```

Or open `/plugin`, go to the **Installed** tab, and update from there.

If the update doesn't take effect, clear the cache and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/abdielou-e2e-skill
/plugin update e2e@abdielou-e2e-skill
```

<details>
<summary>Migrating from v1 to v2</summary>

v2.0.0 split the single skill into four. Update your muscle memory:

| v1 | v2 |
|----|-----|
| `/e2e:e2e` (no args) | `/e2e:dashboard` |
| `/e2e:e2e explore` | `/e2e:explore` |
| `/e2e:e2e build <topic>` | `/e2e:build <topic>` |
| `/e2e:e2e <area>/<scenario>` | `/e2e:run <area>/<scenario>` |

No changes to your `e2e-scenarios/` directory — scenarios, specs, and config carry over as-is.

</details>

## License

MIT
