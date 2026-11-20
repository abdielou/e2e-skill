---
name: e2e-build
description: Use when the user asks to write, add, or change an E2E test scenario, says "build scenario", "write e2e scenario", "create test scenario", "write a test for", "add e2e test", or "e2e build", or invokes /e2e:build with a topic or a ticket.
argument-hint: "<area>/<scenario> | --ticket <number>"
---

# E2E Build

Write a `scenario.md` together with the human. The scenario is the contract that each generated test must prove, thus the human approves each word before you write the file.

Request: `$ARGUMENTS`

```
/e2e:build <topic>             # Write a scenario from a topic
/e2e:build --ticket 1234       # Write a scenario from a work item
```

Read these two files first:

- `<run>/reference/scenario-format.md`
- `<run>/reference/project-layout.md`

`<run>` is the folder of the run skill, next to the folder of this skill. Its name is `run` in the plugin and `e2e-run` in an install from skills.sh. Read each file with `<run>` = `${CLAUDE_SKILL_DIR}/../run`. If the file is not found, do it again with `<run>` = `${CLAUDE_SKILL_DIR}/../e2e-run`. Do not examine the folders first. If a path starts with a `$` variable that has no value, use the folder of this file in its place. If the two paths fail, tell the human to install the `e2e-run` skill from `abdielou/e2e-skill`. Then stop.

## Procedure

1. **Collect the context.**
   - With `--ticket <number>`: get the ticket and its comments with the issue tracker tools that are available. Use the description, the acceptance criteria, and the edge cases. Go to step 3.
   - With a topic: read `e2e-scenarios/COVERAGE.md` if it exists. If it does not, search the code for the routes, pages, and components of the topic. Read the scenarios that exist for the same area.
2. **Ask.** Use **AskUserQuestion** for two to four questions that the code cannot answer. Ask fewer when the context is sufficient. Examples:
   - Which flows to cover. Give the flows that you found as options.
   - Which edge cases or corrected defects to cover.
   - A new scenario file, or more scenarios in a file that exists.
3. **Draft.** Write the scenario in the format of `scenario-format.md`. Use the tone and the level of detail of the scenarios in the same area. Add a `Covers:` line when you know the ticket.
4. **Get approval.** Show the full draft. Ask with **AskUserQuestion**: write it as it is, or change it. Apply each change and show the draft again. Do not write the file before the human approves.
5. **Write.** Write `e2e-scenarios/<area>/<scenario>/scenario.md`. If the area is not clear, ask the human.
6. **Confirm.** Say what you wrote and give the next command:

   ```
   Wrote e2e-scenarios/<area>/<scenario>/scenario.md (N scenarios)

   To generate and run the Playwright spec:
     /e2e:run <area>/<scenario>
   ```

## Rules

- **This skill writes `scenario.md` only.** It does not write a spec. `/e2e:run` does that.
- **Do not duplicate coverage.** If a scenario covers the flow, tell the human and stop.
- **To change a scenario that exists,** read it first. Show the lines before and after the change. Get approval. Then tell the human that the spec is now stale and that `/e2e:run <area>/<scenario>` generates it again.
- **Each Expected item is one result that a person can see.** The run result shows a pass or a fail for each item. Split an item that has two results.
