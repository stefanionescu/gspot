---
title: Security and secrets
description: The security checks gspot runs, and how to run Semgrep.
---

These configurations hold security checks. gspot always selects `secrets`, `dependencies`, and `security`. It selects `docker` and `github-actions` when it finds their files:

| Configuration    | What it checks                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits.                                                                                                   |
| `dependencies`   | OSV-Scanner checks lockfiles for known vulnerable packages at push.                                                                                 |
| `security`       | Semgrep runs shipped and local rules at push, including the rules of the Next.js and Swift configurations, and selected public rule packs manually. |
| `docker`         | Trivy checks container settings and a selected image. See [Docker checks](/reference/configurations/docker/).                                       |
| `github-actions` | zizmor finds unsafe workflows and unpinned actions at commit.                                                                                       |

If gspot finds a real secret, revoke or rotate it first, then remove it from the code. Deleting
the line leaves the secret in Git history.

## Semgrep

Run the shipped Semgrep rules and your own:

```shell
gspot check --only security/semgrep
```

Add your rule files with `tools.semgrep.rule_files`, as paths of files in the repository; gspot refuses a path that
names no file. To run public rule packs, list them in
`tools.semgrep.registry_packs` and run:

```shell
gspot check --only security/semgrep-registry
```

The rule packs need network access. To turn a lint rule off for some paths, add an ignore with a
reason. See [Ignore findings](/use/ignore/).
