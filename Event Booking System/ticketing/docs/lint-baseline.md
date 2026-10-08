# Lint baseline

Captured 29 September 2026 before the Phase 1 lint repairs with `npx eslint -f json src`.

| Rule | Severity | Count |
| --- | --- | ---: |
| `react/no-unescaped-entities` | error | 6 |
| `react-hooks/purity` | error | 2 |
| `react-hooks/set-state-in-effect` | error | 7 |
| `react-hooks/immutability` | error | 1 |
| `@next/next/no-img-element` | warning | 8 |
| `react-hooks/exhaustive-deps` | warning | 1 |
| `@typescript-eslint/no-unused-vars` | warning | 1 |
| `@next/next/no-location-assign-relative-destination` | warning | 1 |
| Unspecified ESLint warnings | warning | 3 |

The errors are being repaired. No `eslint-disable` comments are being added.
