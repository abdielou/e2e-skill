# Scenario File Format

Each `scenario.md` uses this format:

```markdown
# <Title>

<One line that says what this group of scenarios covers.>

Covers: #<ticket>, #<ticket>

## Context

- User must be authenticated
- <A prerequisite of this group>
- Navigate to <start location>

---

## Scenario: <Descriptive name>

### Description

<Two to four sentences that say what to do, in plain language.
Give a field value only when it is important for the test.
Write "any available option" when the choice is not important.>

### Expected

1. <One result that a person can see on the screen>
2. <One more result>

---
```

## Writing rules

1. **State the goal, not the clicks.** Say what to do, not how to operate the UI.
2. **Write for a tester.** A QA tester who knows the application must understand it without code knowledge.
3. **Be specific when it is important.** If a bug was about negative quantities, write "enter a negative value".
4. **Be general when it is not.** Write "select any available option", not the name of one record.
5. **No implementation details.** No selectors, CSS classes, API endpoints, or component names.
6. **One flow for each scenario.** Put related flows in the same file as separate scenarios.
7. **Give each scenario a different name.** The name becomes the test title.
8. **Link tickets when you know them.** Use the `Covers:` line.

## Rules for Expected items

Each `Expected` item becomes one named step in the test, and the run result shows a pass or a fail for each item.

1. **One result for each item.** Write "Redirects to /dashboard" and "The header shows the user name" as two items.
2. **Each result must be visible on the screen.** Do not write "the record is saved in the database".
3. **Quote exact text when the text is the requirement.** Write `Error message "Invalid credentials" is visible`.
4. **Use a numbered list.** The number is the ID of the item: `E1`, `E2`, `E3`.

If you change a scenario file after its spec exists, the spec becomes stale. `/e2e:run` then generates the spec again.
