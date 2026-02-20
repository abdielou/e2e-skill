# E2E Testing Skill for Claude Code

Discover coverage gaps, author human-readable scenarios, and generate/run Playwright E2E tests — all from Claude Code.

> **A note from the human:** Obviously built by an ai agent, directed by a human. My goal was to make E2E testing as human-friendly as possible. The starting point is the **scenario file** — a plain-English scenario doc that the agent consumes to build Playwright specs. That's what you want to mess with if you need to. But the whole flow can be fully automated: let the agent explore your app, build the scenarios, generate the specs, and run them. Enjoy!

## Installation

### As a plugin (recommended)

Add the marketplace and install:

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
/e2e                                # Dashboard: coverage + scenario status
/e2e explore                        # Scan codebase for coverage gaps
/e2e build <topic>                  # Author scenario .md interactively
/e2e build --ticket 1234            # Build scenario from a work item
/e2e <area>/<scenario>              # Run spec (generate on first run)
/e2e <area>/<scenario> --regenerate # Force spec regeneration
/e2e <area>/<scenario> --headless   # Run headless (no visible browser)
```

## How It Works

```
Codebase (routes, pages, components)
         |
    [/e2e explore: scan & compare]
         |
Gap Report -> COVERAGE.md
         |
    [/e2e build: ask questions & write]
         |
e2e-scenarios/<area>/<name>/scenario.md          # Human-readable scenario
         |
    [/e2e <area>/<name>: first run -- AI explores, records, generates]
         |
e2e-scenarios/<area>/<name>/scenario.spec.ts     # Playwright test
         |
    [/e2e <area>/<name>: future runs -- just executes the spec]
```

### Modes

| Mode          | Command                  | What it does                                    |
| ------------- | ------------------------ | ----------------------------------------------- |
| **Dashboard** | `/e2e`                   | Shows coverage status across all scenarios      |
| **Explore**   | `/e2e explore`           | Scans codebase, catalogs features, finds gaps   |
| **Build**     | `/e2e build <topic>`     | Interactive scenario authoring (produces `.md`) |
| **Run**       | `/e2e <area>/<scenario>` | Generates and/or executes Playwright specs      |

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

## Prerequisites

- **Claude Code** with Playwright MCP configured:
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

## Model Profiles

Control cost vs quality for AI subagents:

| Profile       | Explore | Build  | Run (new) | Run (existing) |
| ------------- | ------- | ------ | --------- | -------------- |
| **Optimized** | Sonnet  | Opus   | Opus      | Haiku          |
| **Quality**   | Opus    | Opus   | Opus      | Opus           |
| **Economy**   | Sonnet  | Sonnet | Sonnet    | Haiku          |

Set on first run, or reset by deleting `e2e-scenarios/.config/model-profile.txt`.

## Plugin Structure

```
e2e-skill/
  .claude-plugin/
    plugin.json             # Plugin manifest
  skills/
    e2e/
      SKILL.md              # Main skill definition
      modes/
        dashboard.md        # Dashboard mode instructions
        explore.md          # Explore mode instructions
        build.md            # Build mode instructions
        run.md              # Run mode instructions
        run-generate.md     # Spec generation phases
```

## License

MIT
