# Security and Supply Chain

Four aspect presets: `repository:secrets`, `repository:vulnerabilities`, `repository:dependencies`,
`repository:licenses`. The reference set has all four and the audit's verdict on them is that the
configuration is thorough and the wiring is not.

## `repository:secrets`

| Tool         | Scope                                         | Notes                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gitleaks`   | Whole tree, plus history on demand            | Always with an explicit `--config`. The reference runner passes none, and `.gitleaks.toml` is honoured only because gitleaks discovers it at the source root: change directory and four allowlisted identifiers silently stop being allowlisted. |
| `trufflehog` | Whole tree, verified mode                     | Reaches binary files, which is why 1,173 assets are not invisible                                                                                                                                                                                |
| Preset policy  | Tracked `.env*` files, `.xcconfig`, CI config | A tracked file matching a declared production pattern fails at commit                                                                                                                                                                            |

### Allowlists become exceptions

The reference set has three parallel allowlist mechanisms: `.gitleaks.toml` with four entries,
`quality/security/gitleaks/baseline.json` which grew from 34 to 36 entries, and `bearer.ignore`
which grew from 3 to 8. None carries an owner or an expiry, and the baseline growth is recorded only
in a Markdown table in a branch audit.

Under gspot all three are `[[exception]]` entries with `check`, `finding`, `reason`, `owner` and
`expires`, counted by `gspot exceptions`, and the generated tool configs are rendered from them. One
mechanism, one list, one place to look.

A historical-deleted-file baseline is a legitimate category and gets a kind of its own,
`exception.kind = "history"`, exempt from the expiry requirement but still counted, because a history
baseline can only shrink when history is rewritten.

## `repository:vulnerabilities`

| Tool      | Languages                                               | Requires | Default                    |
| --------- | ------------------------------------------------------- | ---- | -------------------------- |
| `semgrep` | TypeScript, JavaScript, Python, Swift, Bash, Dockerfile | slow | on                         |
| Ruff `S`  | Python                                                  | fast | on, via `language:python`  |
| `codeql`  | TypeScript, JavaScript, Python, Swift                   | slow | opt-in, CI and manual only |

### Semgrep, wired

The reference repository's largest single piece of dead weight: 40 Semgrep rules, a pinned binary, a
runner, a retry wrapper, an environment file, and zero invocations from any hook, task, package
script or plugin. Dormant coverage the audit enumerates:

- 15 API rules: raw query interpolation, unvalidated redirect, SSRF, JWT `none` algorithm, decode
  without verify, auth routes without rate limits, stack traces in responses, secrets in logs.
- 10 Supabase rules: raw SQL interpolation, RPC with user input, service-role key in client code,
  RLS bypass, CORS wildcard with credentials.
- 14 iOS rules: Keychain `kSecAttrAccessibleAlways`, secrets in `UserDefaults` or a plist, plaintext
  HTTP, weak hashes, `UIWebView`, ATS exceptions.
- 1 shared secrets rule.

Those 40 rules are good, and they go into the preset as the base rule set, grouped by the preset that
owns them: API rules under the shared `http` package, Supabase rules under `platform:supabase`, iOS rules
under `tool:xcode`. Plus the upstream registry rule sets that `yap-text-inference` already
vendors (`owasp-top-ten`, `python`, `bash`, `secrets`).

The wiring is structural, not a fix: a rule file that no check reads fails the coverage as an
orphan, so this class of defect cannot recur.

`opengrep` is noted as a drop-in alternative for repositories that need an OSI-licensed engine. Same
rule format, so the preset's rules work under either.

### CodeQL

Opt-in, because a CodeQL database build is minutes, not seconds. The reference setup is manual by
design and has no documented working command, plus a SARIF filter that reads `false-positives.json`
while the file is named `api-false-positives.json`, so the filter has never filtered anything.

The preset ships the scan configuration, a working command for each language, and SARIF output into
the run report. The false-positive filter reads a single declared path, and a filter file with no
matching findings fails as stale, which is the same class of assertion `gspot sync --check` makes about
globs.

## `repository:dependencies`

| Tool                                               | Answers                                                                      | Requires |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| `osv-scanner`                                      | Known vulnerabilities across every lockfile it understands                   | fast |
| `trivy fs`                                         | Vulnerabilities plus misconfiguration, second opinion                        | slow |
| Preset extractor for `Package.resolved`              | Swift advisories, which `osv-scanner` has no extractor for                   | fast |
| `knip`                                             | Unused files, exports and dependencies in TypeScript                         | slow |
| `deptry`                                           | Unused, missing and misplaced Python dependencies                            | fast |
| `syncpack`                                         | One version per dependency across a workspace                                | fast |
| `uv lock --check`, `bun install --frozen-lockfile` | The lockfile matches the manifest                                            | fast |
| Preset check                                         | Every lockfile is tracked, and no two lockfiles for the same ecosystem exist | fast |

### Ignore entries

`osv-scanner.toml` in the reference repository has two ignores, both with excellent multi-line
reasons and neither with an expiry date. The audit's own note: "No expiry dates."

Under gspot those become `[[exception]]` entries with the same reasons and a required `expires`. The
generated `osv-scanner.toml` carries the reason as a comment, so the tool output still explains
itself.

The Vitest case is instructive and the preset models it: the fix for `GHSA-82fw-gwwq-j7x9` needs
Vitest 4, and Vitest 4 fails 49 tests across 10 files. That is a real blocker, and the right
artefact is a exception with an owner and a date plus a tracked task, not an untracked ignore.
`gspot exceptions` then surfaces it every time somebody looks.

### Runtime bumps under scanner pressure

The reference branch bumped five runtime dependencies to clear scanner findings: `axios` twice,
`sharp`, `ws`, `dotenv`, plus about thirty transitive overrides. The audit's verdict: "These may be
right, but they are runtime changes and belong in their own reviewed commit with the test run that
proves them."

The preset's position: `gspot fix` never touches a dependency version. A vulnerability finding
produces either a exception or a tracked task, and the version bump is a human commit with tests. There
is no autofix for supply chain.

## `repository:licenses`

| Tool                          | Ecosystem                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `license-checker-rseidelsohn` | npm. The maintained fork; the reference repository uses unmaintained `license-checker` 25.0.1 in one place and the fork in another. |
| `pip-licenses`                | Python                                                                                                                              |
| Preset extractor                | Swift packages, from `Package.resolved` plus the repository's own licence file                                                      |

Policy lives in one settings block:

```toml
[licenses]
add.allow = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD",
             "CC0-1.0", "Unlicense", "BlueOak-1.0.0", "Python-2.0"]
add.exclude_packages = [
  { package = "eslint-plugin-sonarjs@3.0.0", reason = "LGPL-3.0, dev-only, not distributed" },
]
```

The reference `.license-checker.json` has a per-project `excludePackages` map with about ten entries
per project, several of which are the repository's own packages (`yap-monorepo-api@1.0.0`), which a
license check should never have looked at. The preset excludes workspace-internal packages
automatically and requires a reason for every external exclusion.

Two properties the reference set lacks:

- **Every package set is covered.** The reference pre-push checks `api` and `supabase`; `ios`,
  `quality` and the root manifest are not selectable at all. Under gspot, coverage is by ecosystem
  lockfile, and a lockfile with no license check fails.
- **Dev and runtime are distinguished.** A copyleft licence in a build tool is a different risk from
  one in a shipped dependency, and the policy can differ.

## Staging by requirement

| Preset                         | pre-commit                 | pre-push                              | check and CI      |
| ---------------------------- | -------------------------- | ------------------------------------- | ----------------- |
| `repository:secrets`         | gitleaks over staged paths | gitleaks and trufflehog over the tree | plus history scan |
| `repository:vulnerabilities` | Semgrep over staged paths  | Semgrep over the tree, bearer         | plus CodeQL       |
| `repository:dependencies`    | lockfile freshness         | osv-scanner, knip, deptry, syncpack   | plus trivy        |
| `repository:licenses`        | none                       | full                                  | full              |

The reference repository gates all four behind one variable, `SKIP_SECURITY_SCANS`, which is the
single most consequential skip in the tree. Under gspot each check is individually skippable, skips
need a exception, and a skip appears in the run report. Four switches with owners beat one switch with
none.
