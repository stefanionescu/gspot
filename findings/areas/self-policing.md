# Self-policing and defensive code

This part is a hunt across the whole repository for two kinds of code: self-policing code (a test, script, check, CI
step, lint rule or `gspot.toml` setting whose only job is to make this repository follow its own house rules, and
which protects no user) and defensive padding (a guard, fallback, re-read or re-validation for a state that cannot
happen, or that other code already handles). Most items found here are fixed by the records of the area they live in:
the generated `public.*`/`contracts.*` import rule (ARC-002), the `structure/config-logic` and
`structure/test-placement` checks (CKG-010, CKG-011), the install guards and per-file copies (LIF-001, LIF-002), the
flag-in-help test (TTO-001), the test-only install cache (TTO-003) and the CI lockfile step (GEN-002). The target: no
code that only polices this repository, and no guard without a reachable state. The two items below have no other
record.

## Findings

### SLF-023: The ESLint plugin version is typed twice, so a script checks that they match

- Where: `packages/cli/configurations/language/javascript/manifest.toml:309-315` (`version = "0.1.0"` for
  `@gspothq/eslint-plugin`), `packages/eslint-plugin/package.json:3`, `scripts/release.ts:16-19`,
  `tests/cli/scripts/release.test.ts:17-24`
- Kind: simplify
- Problem: The JavaScript manifest pins the plugin by hand, and the release script refuses a release when that pin and
  the plugin's `package.json` disagree. One value is typed in two places, and a script polices the copy.
- Fix: Delete the hand-typed plugin version from the manifest. `scripts/build.ts`, the one build script that builds
  both packages, writes the plugin pin from `packages/eslint-plugin/package.json` into the CLI's built manifest data
  (PLG-008), so the version is typed once and no exception to the import rule between the CLI and the plugin is
  needed. `scripts/release.ts` is deleted whole, with its version check and its test.
- Size: small

### SLF-030: Lockfile match helpers turn every error into "no match"

- Where: `packages/cli/src/tools/npm/lockfiles.ts:62-71` (`lockfileMatches`),
  `packages/cli/src/tools/python/contracts.ts:83-101` (`pythonLockfileMatches`)
- Kind: fix-bug
- Problem: Both wrap all their work in `catch { return false; }`, so a bug in gspot becomes a silent "mismatch", which
  makes the package manager work out a new lockfile over the network. The Python helper also checks the `pyproject.toml` that gspot
  generated itself against a schema again.
- Fix: Catch only the error of reading and parsing the lockfile, so an unreadable or broken lockfile still counts as
  "no match" and gspot writes a new one; let every other error throw. Parse gspot's own generated `pyproject.toml`
  text without the schema. `pythonLockfileMatches` moves to `packages/cli/src/tools/python/project.ts`.
- Size: small
