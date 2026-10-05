---
title: Security
description: The security checks gspot runs, and how to run Semgrep, the Swift security rules, and CodeQL.
---

Five configurations carry security checks. Select the ones your repository needs:

| Configuration  | Checks                                                                                                                                                                                    | Stage                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `secrets`      | Gitleaks scans staged changes and pushed commits. At push, TruffleHog sends possible secrets to the service that issued them to learn whether they still work. This needs network access. | Commit and push                                             |
| `dependencies` | The Open Source Vulnerabilities (OSV) scanner checks your lockfiles for known vulnerable packages.                                                                                        | Push                                                        |
| `security`     | Semgrep runs the shipped rules and your own.                                                                                                                                              | Push                                                        |
| `security`     | Semgrep runs the public rule packs you choose, and CodeQL runs its queries.                                                                                                               | Manual                                                      |
| `docker`       | Trivy checks the container configuration and an image you name.                                                                                                                           | See the [Docker checks](/reference/configurations/docker/). |
| `actions`      | zizmor finds unsafe GitHub Actions workflows, and pinact checks that every action is pinned.                                                                                              | Commit (zizmor), push (pinact)                              |

A check whose tool is missing fails, and `gspot explain <check>` prints what the check needs.

If gspot finds a real secret, revoke or rotate it first, then remove it from the code. Deleting
the line leaves the secret in Git history.

## Semgrep

With the `security` configuration, run the shipped rules and your own:

```shell
gspot check --only security/semgrep
```

Add your rule files with `semgrep.rule_files`. To run public rule packs, list them in
`tools.semgrep.registry` and run:

```shell
gspot check --only security/semgrep-registry
```

The rule packs need network access. To turn a rule off for some paths, record an ignore with a
reason; see [the policy file](/guides/policy/#record-one-exception).

## Swift security rules

With the `security` and `swift` configurations, Semgrep also runs an iOS rule pack at the push stage, over
Swift sources and plist files. The [swift configuration](/reference/configurations/swift/) lists what it checks.

## CodeQL

With the `security` configuration, set the languages, install, and scan:

```shell
gspot set tools.codeql.languages python
gspot install
gspot check --only security/codeql
```

CodeQL scans a copy of your sources, and the findings name paths in your repository. The
`security` configuration pins the CodeQL CLI and its query packs. The first scan downloads the packs. When
the analysis fails or its report cannot be read, the check exits with `2`.
