---
title: Security and Secrets
description: The security checks gspot runs, and how to run Semgrep.
configurations: [security, docker, github-actions, secrets]
---

These configurations hold security checks. The [configuration reference](/reference/configurations/#always-selected)
lists which ones gspot always selects. It selects `docker` and `github-actions` when it finds their files:

| Configuration    | What it checks                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits.                                                             |
| `dependencies`   | OSV-Scanner checks lockfiles for known vulnerable packages at push.                                           |
| `security`       | Semgrep runs the FastAPI rules and your rule files at push.                                                   |
| `docker`         | Trivy checks container settings and a selected image. See [Docker checks](/reference/configurations/docker/). |
| `github-actions` | zizmor finds unsafe workflows and unpinned actions at commit.                                                 |

If gspot finds a real secret, revoke or rotate it first, then remove it from the code. Deleting
the line leaves the secret in Git history.

## Semgrep

Run the FastAPI rules and your own:

```shell
gspot check --only security/semgrep
```

Add your rule files with `security.rule_files`, as paths of files in the repository; gspot refuses a path that
names no file. Without shipped or local rules, gspot does not install Semgrep.
To turn a lint rule off for some paths, add an ignore with a reason. See [Ignore findings](/use/ignore/).
