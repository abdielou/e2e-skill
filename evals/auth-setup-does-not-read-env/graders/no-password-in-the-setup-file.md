---
type: regex
target: { source: file, path: e2e-scenarios/auth.setup.ts }
pattern: 'hunter2-eval-only'
match: not_contains
weight: 2
---
