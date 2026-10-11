# Inline suppressions and test skips

An inline suppression is a comment that turns a lint rule off for one line, for example
`// eslint-disable-next-line n/no-sync -- reason: ...`; gspot's `gspot/suppressions` check makes each one carry a
reason. A test skip makes a test not run on some machines, for example `test.skipIf(!isPosix)`, and a skipped test
reports "skipped", not "failed", so a skip can hide a broken feature. This repository has 17 inline suppressions (12
from the Codex period, 5 needed) and 111 skip lines, and no `@ts-ignore`, `# noqa`, `test.only` or other suppression
syntax in its own code. The target: only the needed suppressions stay, each with a plain reason; every skip names a
real limit of the operating system or of a tool build, written one way, from one test setup file; every other
suppression and skip goes with the record that fixes its cause.

## Where each suppression goes

| Where                                                                                                                                       | Lint rule                                                                | Result                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `packages/cli/src/checks/general/contracts.ts:36`                                                                                           | `sonarjs/no-invariant-returns`                                           | goes: the callback gets one `return` (CKG-007)                 |
| `packages/cli/src/parsers/output/contracts.ts:79`, `packages/cli/src/parsers/sql/public.ts:30`                                              | `@typescript-eslint/no-misused-spread`                                   | goes or becomes one (DEC-034)                                  |
| `packages/cli/src/platform/root/writes.ts:27`, `:221`                                                                                       | `n/no-deprecated-api`, `@typescript-eslint/no-deprecated` (`lchmodSync`) | go: a link's own mode is not set (PLR-029)                     |
| `packages/cli/src/types/parsers/settings.ts:11`                                                                                             | `@typescript-eslint/consistent-type-definitions`                         | stays, with a plain reason (SUP-022)                           |
| `packages/cli/src/types/platform/runtime.ts:5`                                                                                              | `@typescript-eslint/consistent-type-definitions`                         | stays until TypeScript declares `RegExp.escape` (PLR-050)      |
| `tests/cli/commands/apply.test.ts:36`, `tests/cli/execution/fixers/policy-layout.test.ts:64`, `tests/cli/platform/claims.test.ts:28,58,135` | `n/no-sync`                                                              | go: the rule is off for every user (DEC-011)                   |
| `tests/cli/execution/errors.test.ts:27`                                                                                                     | `@typescript-eslint/only-throw-error`                                    | goes with the test (SUP-012)                                   |
| `tests/cli/lifecycle/hooks.test.ts:208,210`                                                                                                 | `n/no-sync`                                                              | go with the mock tests of the hook check (TEL-003)             |
| `tests/cli/policy/templates/sources.test.ts:30`                                                                                             | `unicorn/prefer-https`                                                   | stays, with a plain reason (SUP-022)                           |
| `tests/tools/manifest-flags-in-help.test.ts:64`                                                                                             | `no-control-regex`, `sonarjs/no-control-regex`                           | goes with the file (TTO-001); the shipped rule pair is SUP-024 |

## Findings

### SUP-008: Tests skip in many different ways, and Docker tests pass silently when Docker is down

- Where: `tests/harness/docker.ts:1-23` (`hasLinuxDocker`, which asks `docker info` at run time),
  `tests/tools/configurations/infra/docker/image.test.ts:26`, `tests/tools/configurations/infra/nginx.test.ts:23`,
  `tests/tools/configurations/cases.test.ts:284` with `tests/config/tools/configurations/infra/docker.ts:26`
  (`docker: true`); `tests/config/harness/platforms.ts:1-5` (`isPosix`, `isMacos`), `tests/harness/platforms.ts`
  (`hasToolBuild`, `usePlatform`); the case data `platforms: ['darwin']` (`tests/config/tools/configurations/cases.ts:32,55`,
  `tests/config/tools/configurations/language/swift/checks.ts:11`); the Ansible identity check
  (`tests/tools/configurations/cases.test.ts:275-278`); the `isPosix` gates that mean "SwiftFormat has a build"
  (`tests/tools/configurations/language/swift/docs.test.ts:26,38,69,99`); raw `process.platform` checks in tests
- Kind: simplify
- Problem: Every other skip depends on the operating system or the pinned tool list, which are fixed. The Docker skip
  depends on the state of the machine: if Docker fails to start on the Linux runner, five Docker tests turn into
  "skipped" and CI stays green. The tests also say "this machine cannot" in many ways (`isPosix`, `isMacos`,
  `hasToolBuild`, `process.platform`, `test.if`, `describe.if`, early returns, `platforms` and `posix` fields), and
  `skipIf(!isPosix)` is a double negative for "skip on Windows". The case data repeats by hand what the manifest pins
  already say, and gets it wrong in one place: the SwiftFormat case in `language/swift/checks.ts:13-17` has no gate,
  although SwiftFormat has no Windows build.
- Fix: One test setup file, `tests/setup/operating-systems.ts`, holds `isWindows`, `isMacos`, `isLinux`,
  `hasToolBuild` and `useOperatingSystem`. Tests use only `test.skipIf(...)` and `describe.skipIf(...)`, write "skip
  on Windows" as `skipIf(isWindows)`, and never read `process.platform` themselves. A test that needs a tool skips
  when the tool's pin has no build for this machine (`hasToolBuild(<tool of the check>)`, read from the manifest):
  delete the `platforms` field from the case data and types, the Ansible identity check, and the `isPosix` gates in
  `swift/docs.test.ts` (they become `hasToolBuild('swiftformat')`); the SwiftFormat case gets the same gate. Docker
  tests skip only off Linux (`!isLinux`), so a missing Docker on the Linux runner fails the run. Delete
  `tests/harness/docker.ts` and its imports. The Supabase test that needs Docker is deleted, with its task and
  workflow; its other cases stay ordinary integration tests in `tests/integration/platform/supabase.test.ts`.
- Size: medium

### SUP-012: A test throws a non-error value to cover a fallback that gspot's own code cannot reach

- Where: `tests/cli/execution/errors.test.ts:1-37` (whole file, suppression at `:27`),
  `tests/config/cli/execution/errors.ts:1-4` (`NON_ERROR_FAILURES`)
- Kind: delete
- Problem: The test makes a built-in check `throw 'upstream rejected'` and `throw null` and checks the message "The
  project/source check failed: ...". Built-in checks are gspot's own code, and gspot's lint rules forbid throwing
  non-errors, which is why the test needs a suppression. Its reason, "non-Error failures from external checks", is
  not what the test does. `tests/cli/execution/prerequisites.test.ts:75-101` already covers a built-in check that
  throws an `Error`.
- Fix: Delete both files. Keep the one-line `String(error)` branch in `packages/cli/src/execution/public.ts:90`:
  TypeScript needs it for an unknown value, and a library that a built-in check calls could throw a non-error. The
  error path stays tested by the `prerequisites.test.ts` test, which moves to `tests/unit/cli/execution/run.test.ts`.
- Size: small

### SUP-022: The suppressions and skips that are needed should say why in plain words

- Where: needed suppressions `packages/cli/src/types/parsers/settings.ts:11` and
  `tests/cli/policy/templates/sources.test.ts:28-30`; needed skips: tool builds
  (`tests/tools/configurations/general/codeql.test.ts:22`, `general/secrets/semgrep.test.ts:17`,
  `general/security.test.ts:12`, `infra/ansible.test.ts:16,58`, `infra/nginx.test.ts:73`,
  `language/swift/checks.test.ts:14`, `language/swift/scopes.test.ts:16`, `test/swift-tests.test.ts:145,171`,
  `tests/tools/generation/platform-security.test.ts:13`, `tests/tools/generation/semgrep.test.ts:42,73,116,179,205,243`);
  macOS toolchain (`tests/tools/configurations/language/bash/bats.test.ts:13`, `language/swift/build.test.ts:16,47`,
  `test/swift-tests.test.ts:29`); signals (`tests/cli/commands/check/cancellation.test.ts:13`,
  `tests/cli/execution/tool-runner/arguments.test.ts:134`, `tests/cli/platform/spawn/backends.test.ts:90`,
  `tests/packages/launcher.test.ts:46`, `tests/tools/commands/cancellation.test.ts:53,106,145`); modes and direct
  script runs (`tests/cli/execution/tool-runner/adapters.test.ts:96`, `tests/cli/lifecycle/hooks.test.ts:107`,
  `tests/cli/lifecycle/ownership/conflicts/plans.test.ts:184`, `tests/cli/platform/spawn/backends.test.ts:67,168`,
  `tests/cli/platform/root.test.ts:19`); other limits (`tests/cli/repository/tracked/boundaries.test.ts:7`, named
  pipes; `tests/cli/parsers/output/formats.test.ts:144`, case-sensitive Linux file names;
  `tests/cli/checks/general/duplication.test.ts:114`, a Windows-only path form; `tests/cli/commands/apply.test.ts:169`;
  `tests/cli/tools/inspect/hints.test.ts:63`; `tests/cli/generation/serialization/documents.test.ts:92`;
  `tests/tools/configurations/language/bash/syntax.test.ts:19,31`)
- Kind: rewrite-text
- Problem: These are justified. The Zod `interface` is the documented way to add metadata types, and the template test
  must pass a plain http address to prove that it is refused. But the reasons are hard to read ("Zod metadata
  requires interface merging in its native module"), `sources.test.ts:28` is a stray blank line, and several skips
  state no limit at all. Tool-build skips are read from the manifest pins, so they are stable.
- Fix: Rewrite the two kept reasons:
    - `settings.ts:11`: "-- reason: Zod reads extra metadata types only from an interface." (the block moves with
      S09-012)

    - `sources.test.ts:30`: "-- reason: The test must pass an http address to prove it is refused." Delete the blank
      line 28.

    Keep the listed skips, written with the names of `tests/setup/operating-systems.ts` (SUP-008), with a one-line
    comment that names the Windows or macOS limit where none is written. These skips change or go with other records:
    `tests/cli/execution/tool-runner/adapters.test.ts:21,74` (TEL-035), `tests/cli/checks/language/swift/build/compiler.test.ts:34`
    (TCO-015) and `:181` (TCO-018), `tests/cli/platform/root.test.ts:199,224` (TPR-002),
    `tests/cli/platform/spawn/termination.test.ts:185` (TPR-072), `tests/tools/parsers/output/plist.test.ts:13`,
    `tests/tools/execution/fixers.test.ts:33` (TTO-019), `tests/tools/commands/swift-quickstart.test.ts:23` (TTO-018),
    the case `platforms` data (SUP-008), the Express test `tests/tools/generation/security.test.ts:22` (TTO-006) and the
    validate test `tests/tools/generation/semgrep.test.ts:142` (TTO-013). `tests/cli/scripts/plugin.test.ts:14` goes
    with `scripts/plugin.ts`.

- Size: small

### SUP-024: The shipped ESLint rules turn on two rules for one problem, so one line needs two suppressions

- Where: `packages/cli/configurations/language/javascript/eslint-presets.json` (`/eslint/blocks[0]/rules/no-control-regex`
  and `/sonar/blocks[0]/rules/sonarjs/no-control-regex`); seen at `tests/tools/manifest-flags-in-help.test.ts:64`
- Kind: simplify
- Problem: `no-control-regex` (core ESLint) and `sonarjs/no-control-regex` report the same thing. Users of gspot get
  two findings for one line and must name both lint rules in a suppression. The shipped rules already avoid this for
  deprecations: `sonarjs/deprecation` is off where the TypeScript rule runs.
- Fix: Add `'sonarjs/no-control-regex': 'off'` to `SONAR_RULES` in `packages/cli/src/config/generation/eslint-rules.ts`
  and keep the core rule. Do not edit the captured rule lists: `scripts/update-rule-lists.ts` writes them from the
  upstream packages and would undo a hand edit. Run `gspot apply`. The one suppression that names both rules goes
  with its file (TTO-001).
- Size: small
