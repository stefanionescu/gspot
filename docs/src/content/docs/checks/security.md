---
title: Security and secrets
description: The security checks gspot runs, and how to run Semgrep and the Swift security rules.
---

These configurations hold security checks. gspot always selects `secrets`, `dependencies`, and `security`. It selects `docker` and `github-actions` when it finds their files:

| Configuration    | What it checks                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits. TruffleHog scans pushed commits.                            |
| `dependencies`   | OSV-Scanner checks lockfiles for known vulnerable packages at push.                                           |
| `security`       | Semgrep runs shipped and local rules at push, and selected public rule packs manually.                        |
| `docker`         | Trivy checks container settings and a selected image. See [Docker checks](/reference/configurations/docker/). |
| `github-actions` | zizmor finds unsafe workflows and actions without commit pins at commit.                                      |

At push, TruffleHog sends possible secrets to their issuing service to check whether they still work. This needs
network access.

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
reason. See [Ignore a finding](/use/ignore/).

## Swift security rules

Semgrep also runs the Swift security lint rules that gspot ships with the `swift` configuration. These rules check Swift sources and plist files. The [swift configuration](/reference/configurations/swift/) lists what it checks.
