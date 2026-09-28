---
title: Security
description: Run the Swift security rules and a configured CodeQL analysis.
---

Run commands from your repository root with [gspot installed](/guides/install/).

## Choose the scan

Security checks cover different inputs. Select the configurations your repository needs:

| Configuration  | Checks                                                                                                               | When                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `secrets`      | Gitleaks scans staged changes and pushed commits; TruffleHog verifies candidate secrets with their issuing services. | Commit and push.                                  |
| `dependencies` | Open Source Vulnerabilities (OSV) scans supported lockfiles for known vulnerable dependencies.                       | Push.                                             |
| `security`     | Semgrep runs shipped and repository rule packs.                                                                      | Push.                                             |
| `security`     | Configured public Semgrep packs and CodeQL queries.                                                                  | Manual.                                           |
| `docker`       | Trivy checks container configuration and a configured image.                                                         | See the [Docker checks](/reference/kits/docker/). |

Use `gspot explain <check>` for prerequisites and the enabled policy. A missing tool or an
unconfigured manual scan is not a successful security scan. If a reported secret is real,
revoke or rotate it before removing it from code; deleting the current line leaves Git history.

## Semgrep rules

Select `security`, then run the shipped and repository rules:

```shell
gspot check --stage push --only security/semgrep
```

Add local rule paths with `tools.semgrep.rules`. Set `tools.semgrep.registry` to the public
packs you want, then run `gspot check --stage manual --only security/semgrep-registry`.
Registry checks require network access. Keep exceptions scoped to the affected rule and paths
with a reason; see [configuration](/guides/customize/#record-one-exception).

## Swift security rules

Select `security` with `swift` to run the iOS Semgrep pack at push. It checks Keychain
accessibility, secret storage, credential literals, insecure network settings, and weak
hashes. It also checks unsafe pointer operations, web views, sensitive logging, and
JavaScript build-script injection. Plist files participate in the security check.
The generated pack is `.gspot/config/semgrep/ios.yml`.

## CodeQL analysis

In a repository with the `security` configuration selected, add the languages to scan in `gspot.toml`:

```toml
[tools.codeql]
languages = ["python"]
```

Run these commands from the repository root:

```bash
gspot apply
gspot install
gspot check --stage manual --only security/codeql --no-cache
```

CodeQL runs against a disposable copy of the selected sources. Findings use repository-relative
paths. The security configuration pins the CLI and its matching query packs; the first scan downloads
missing packs. An unreadable report or failed native analysis returns status 2. Repair the
reported tool failure before treating the scan as complete.
