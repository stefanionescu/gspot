---
title: Security and secrets
description: What to do when gspot finds a secret, and the security checks that gspot runs.
configurations: [security, docker, github-actions, secrets]
---

## When gspot finds a secret

First revoke the secret, or replace it with a new one, at the service that issued it. Then remove it from the code.
Deleting the line leaves the secret in the Git history, so treat the secret as public.

## Security checks

These configurations hold security checks. The [configuration reference](/reference/configurations/#always-selected)
lists the ones that are on in every repository. gspot turns on `docker` and `github-actions` when it finds their files:

| Configuration    | What it checks                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Gitleaks scans staged changes and pushed commits.                                                                     |
| `dependencies`   | Before each push, OSV-Scanner checks the lockfiles for packages with known vulnerabilities.                           |
| `security`       | Before each push, Semgrep runs the FastAPI rules and your own rule files.                                             |
| `docker`         | Trivy checks container settings and an image that you choose. See [Docker checks](/reference/configurations/docker/). |
| `github-actions` | Before each commit, zizmor finds unsafe workflows and actions that are not pinned.                                    |

## Semgrep

To run the FastAPI rules and your own Semgrep rules:

```shell
gspot check --only security/semgrep
```

To add your own rule files, list their paths in `security.semgrep_rules`. gspot rejects a path that names no file. When
gspot ships no rules for your configurations and you add none, gspot does not install Semgrep. Semgrep runs on macOS
and Linux only.
