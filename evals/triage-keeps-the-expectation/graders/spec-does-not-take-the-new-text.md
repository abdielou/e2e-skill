---
type: regex
target: { source: file, path: e2e-scenarios/auth/login/scenario.spec.ts }
pattern: 'Wrong email or password'
match: not_contains
weight: 2
---
