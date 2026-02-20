# Build Mode

When `/e2e build <topic>` is invoked:

## Step 1: Gather Context

**If `--ticket <number>` is provided:**
1. Use available MCP tools (e.g., work item tracker, issue tracker) to fetch the ticket details and comments
2. Extract the feature description, acceptance criteria, and any edge cases
3. Skip to Step 3 (no questions needed — the ticket is the source of truth)

**If only a topic name is provided:**
1. Check if `e2e-scenarios/COVERAGE.md` exists — if so, read it for instant context (feature names, descriptions). This avoids re-scanning the codebase.
2. If no catalog exists, search the codebase for related routes, pages, and components
3. Read existing scenarios to understand what's already covered for this area
4. Proceed to Step 2

## Step 2: Ask Clarifying Questions

Use **AskUserQuestion** to gather requirements. Ask 2-4 focused questions based on what you found in the codebase. Examples:

- "What feature area does this cover?" (if the topic is ambiguous)
- "Which flows should be tested?" (list discovered flows as options: create, edit, delete, etc.)
- "Any specific edge cases or bug fixes to cover?" (offer to link tickets)
- "Should this be a new file or added to an existing scenario file?" (if related scenarios exist)

Adapt questions to what you already know. If the codebase scan gives you enough context, ask fewer questions.

## Step 3: Draft the Scenario File

Generate the `.md` file following the **Scenario File Format** defined in `skill.md`. Read existing scenarios in the same area to match their tone and level of detail.

## Step 4: Present for Review

Display the full scenario file content and ask:

> Here's the draft scenario file for `<name>.md`. It has N scenarios covering [brief summary].
>
> Should I:
> 1. Write it as-is
> 2. Make changes (tell me what to adjust)

Use **AskUserQuestion** for this confirmation.

## Step 5: Write the File

Write the approved scenario to `e2e-scenarios/<area>/<name>/scenario.md` using the **Write** tool. Create the scenario folder if it doesn't exist.

Determine the correct subdirectory based on:
- The topic/feature area from the user's request or the clarifying questions
- Existing directory structure (place alongside related scenarios)
- If unsure, ask the user which directory to use

Confirm:
```
Wrote e2e-scenarios/<area>/<name>/scenario.md (N scenarios)

To generate and run the Playwright spec:
  /e2e <area>/<name>
```
