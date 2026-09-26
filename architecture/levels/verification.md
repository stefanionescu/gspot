# Level Policy Verification

Verification ran on macOS ARM64 with pinned Bun 1.4.2. The repository retains
`level = "all"` and its explicit policy exceptions. No remote CI, publication, or
deployment is part of this change.

## Passing Checks

| Lane                         | Result                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Type checks                  | Repository and documentation TypeScript checks pass.                                  |
| Full Bun suite               | 1,922 tests pass, zero fail, with 8,973 assertions.                                   |
| Final focused level contract | 11 tests pass with 660 assertions after inventory relocation and test typing cleanup. |
| Source acceptance            | 21 tests pass with 115 assertions, including both levels.                             |
| Packaged standalone plugin   | One consumption test passes with 10 assertions.                                       |
| Documentation tests          | 15 tests pass with 1,708 assertions.                                                  |
| Builds                       | CLI, plugin, and 324 documentation pages build successfully.                          |
| Documentation links          | All built-site links and fragment targets are valid.                                  |
| Managed generation           | Repeated source CLI apply reports all 147 files up to date.                           |

The source acceptance and package-consumption lanes use an isolated local package
registry. Native defect-and-correction coverage includes both levels for Swift
security and documentation, and shell formatting. Focused Ruff generation and
adoption checks pass.

## Failed Checks and Unavailable Verification

The full native-tool lane fails: 186 tests pass and two fail. Both failures require
the unavailable Docker daemon:

- Supabase local database type generation and freshness checking.
- Container-image scanning of a generated test key, invalid configuration, and a clean image.

The required staged gate also fails. Its findings include repository structure,
existing oversized brand assets, stale paths, README shape, prose conventions,
and ESLint diagnostics. Remaining diagnostics also affect added inventory and
implementation files, including upstream spelling, callback-size conventions,
and the explicit ESLint membership table's line count. This is not a clean gate.
No diagnostic, exception, or policy setting is weakened to conceal these findings.

Earlier full Bun and native runs failed on assertions encoding changed defaults.
Those runs remain failures; corrected full reruns produce the results above.
Focused passes do not replace the failed native lane or staged gate.

Native Windows and Linux execution is not verified on this macOS host. Docker-backed
verification requires a working daemon and remains outstanding.
