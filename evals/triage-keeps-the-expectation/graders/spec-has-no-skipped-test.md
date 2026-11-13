---
type: regex
target: { source: file, path: e2e-scenarios/auth/login/scenario.spec.ts }
pattern: 'test\.(skip|fixme|fail)\('
match: not_contains
---
