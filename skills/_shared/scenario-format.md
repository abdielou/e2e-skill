# Scenario File Format

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

## Scenario Writing Rules

1. **Goal-oriented, not step-by-step** — Describe *what* to accomplish, not *how* to click through it
2. **Human-readable** — A QA tester who knows the app should understand it without code knowledge
3. **Specific when it matters** — If a bug was about negative quantities, say "enter a negative value"
4. **Generic when it doesn't** — "Select any available option" instead of hardcoding a specific entity name
5. **Verifiable expectations** — Each expected outcome should be something you can see on screen
6. **No implementation details** — No selectors, no CSS classes, no API endpoints, no component names
7. **Atomic scenarios** — Each scenario tests one flow; multiple related flows go in one file
