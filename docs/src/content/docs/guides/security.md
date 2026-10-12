---
title: Security
description: The security checks gspot runs, and how to run Semgrep, the Swift security rules, and CodeQL.
---

These configurations hold security checks. gspot always selects `secrets`, `dependencies`, and `security`. It selects `docker` and `github-actions` when it finds their files:

| Configuration    | Checks                                                                                                                                                                                    | Stage                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits. At push, TruffleHog sends possible secrets to the service that issued them to learn whether they still work. This needs network access. | Commit and push                                             |
| `dependencies`   | The Open Source Vulnerabilities (OSV) scanner checks your lockfiles for known vulnerable packages.                                                                                        | Push                                                        |
| `security`       | Semgrep runs the shipped rules and your own.                                                                                                                                              | Push                                                        |
| `security`       | Semgrep runs the public rule packs you choose, and CodeQL runs its queries.                                                                                                               | Manual                                                      |
| `docker`         | Trivy checks the container configuration and an image you name.                                                                                                                           | See the [Docker checks](/reference/configurations/docker/). |
| `github-actions` | zizmor finds unsafe GitHub Actions workflows, and pinact checks that every action is pinned.                                                                                              | Commit (zizmor), push (pinact)                              |

If a tool cannot run, the check shows `missing` and the run ends as incomplete with exit code 2. `gspot explain <check>` prints what the check needs.

If gspot finds a real secret, revoke or rotate it first, then remove it from the code. Deleting
the line leaves the secret in Git history.

## Semgrep

Run the shipped rules and your own:

```shell
gspot check --only security/semgrep
```

Add your rule files with `tools.semgrep.rule_files`. To run public rule packs, list them in
`tools.semgrep.registry_packs` and run:

```shell
gspot check --only security/semgrep-registry
```

The rule packs need network access. To turn a rule off for some paths, record an ignore with a
reason. See [Ignore a finding](/guides/exclude/#ignore-a-finding).

## Swift security rules

Semgrep also runs the Swift security lint rules that gspot ships with the `swift` configuration. These rules check Swift sources and plist files. The [swift configuration](/reference/configurations/swift/) lists what it checks.

## CodeQL

Set the languages, install, and scan:

```shell
gspot set tools.codeql.languages python
gspot install
gspot check --only security/codeql
```

CodeQL scans a copy of your sources, and the findings name paths in your repository. The
`security` configuration pins the CodeQL CLI and its query packs. The first scan downloads the packs. When
the analysis fails or gspot cannot read its report, the check exits with `2`.
