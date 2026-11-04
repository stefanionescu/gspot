---
title: Security and secrets
description: What to do when gspot finds a secret, and the security checks that gspot runs.
configurations: [security, docker, github-actions, secrets]
---

## When gspot finds a secret

Revoke or rotate the secret first. Then remove it from the code. Deleting the line leaves the secret in the Git
history, so treat it as public.

## Security checks

These configurations hold security checks. The [configuration reference](/reference/configurations/#always-selected)
lists which ones gspot always selects. It selects `docker` and `github-actions` when it finds their files:

| Configuration    | What it checks                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits.                                                             |
| `dependencies`   | OSV-Scanner checks lockfiles for known vulnerable packages at push.                                           |
| `security`       | Semgrep runs the FastAPI rules and your rule files at push.                                                   |
| `docker`         | Trivy checks container settings and a selected image. See [Docker checks](/reference/configurations/docker/). |
| `github-actions` | zizmor finds unsafe workflows and unpinned actions at commit.                                                 |

## Semgrep

Run the FastAPI rules and your own:

```shell
gspot check --only security/semgrep
```

Add your rule files with `security.semgrep_rules`, as paths of files in the repository; gspot refuses a path that
names no file. Without shipped or local rules, gspot does not install Semgrep. Semgrep runs on macOS and Linux only.
