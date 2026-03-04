---
name: build
description: Author human-readable E2E test scenarios interactively. Use when user says "build scenario", "write e2e scenario", "create test scenario", "e2e build", or invokes /e2e:build.
compatibility: Requires an MCP-capable agent. Node.js and @playwright/test must be installed.
---

# E2E Build

Interactively author human-readable scenario `.md` files for E2E testing. The agent gathers context, asks clarifying questions, drafts the scenario, and writes it after approval.

## Usage

```
/e2e:build <topic>                  # Author scenario interactively
/e2e:build --ticket 1234            # Build scenario from a work item
```

Examples:

```
/e2e:build settings/preferences     # Asks questions → writes settings/preferences/scenario.md
/e2e:build --ticket 1234            # Build scenario from a specific ticket
```

---

## Instructions

**Step 0: Run Phase -2 (Model Profile Check).** Read `../_shared/model-profiles.md` (relative to this skill's directory) and execute the "Phase -2: Model Profile Check" section. The current mode is `build`.

**Then read** `../_shared/directory-structure.md`, `../_shared/scenario-format.md`, and `../_shared/rules-general.md` for context.

---

### Step 1: Gather Context

**If `--ticket <number>` is provided:**
1. Use available MCP tools (e.g., work item tracker, issue tracker) to fetch the ticket details and comments
2. Extract the feature description, acceptance criteria, and any edge cases
3. Skip to Step 3 (no questions needed — the ticket is the source of truth)

**If only a topic name is provided:**
1. Check if `e2e-scenarios/COVERAGE.md` exists — if so, read it for instant context (feature names, descriptions). This avoids re-scanning the codebase.
2. If no catalog exists, search the codebase for related routes, pages, and components
3. Read existing scenarios to understand what's already covered for this area
4. Proceed to Step 2

### Step 2: Ask Clarifying Questions

Use **AskUserQuestion** to gather requirements. Ask 2-4 focused questions based on what you found in the codebase. Examples:

- "What feature area does this cover?" (if the topic is ambiguous)
- "Which flows should be tested?" (list discovered flows as options: create, edit, delete, etc.)
- "Any specific edge cases or bug fixes to cover?" (offer to link tickets)
- "Should this be a new file or added to an existing scenario file?" (if related scenarios exist)

Adapt questions to what you already know. If the codebase scan gives you enough context, ask fewer questions.

### Step 3: Draft the Scenario File

Generate the `.md` file following the **Scenario File Format** from `../_shared/scenario-format.md`. Read existing scenarios in the same area to match their tone and level of detail.

### Step 4: Present for Review

Display the full scenario file content and ask:

> Here's the draft scenario file for `<name>.md`. It has N scenarios covering [brief summary].
>
> Should I:
> 1. Write it as-is
> 2. Make changes (tell me what to adjust)

Use **AskUserQuestion** for this confirmation.

### Step 5: Write the File

Write the approved scenario to `e2e-scenarios/<area>/<name>/scenario.md` using the **Write** tool. Create the scenario folder if it doesn't exist.

Determine the correct subdirectory based on:
- The topic/feature area from the user's request or the clarifying questions
- Existing directory structure (place alongside related scenarios)
- If unsure, ask the user which directory to use

Confirm:
```
Wrote e2e-scenarios/<area>/<name>/scenario.md (N scenarios)

To generate and run the Playwright spec:
  /e2e:run <area>/<name>
```
