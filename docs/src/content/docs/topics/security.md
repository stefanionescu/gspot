---
title: Security and secrets
description: What to do when gspot finds a secret, and the security checks that gspot runs.
configurations: [security, docker, github-actions, secrets]
---

gspot scans each commit for secrets. Before each push, it checks your dependencies and your code for known security
problems.

## When gspot finds a secret

When the pre-commit hook reports a secret, the commit did not happen. Remove the value from your staged files, and load
it from the environment. When `secrets/gitleaks-pushed` reports a secret, it is in a commit, and deleting the line leaves
it in the history. Revoke it at the service that issued it, then rewrite the commit. A full `gspot check` also scans
files that you have not committed; if the value was never committed, only remove it.

When the value is not a secret, such as a sample key in a test fixture, ignore that file in both checks:

```shell title="example"
gspot ignore secrets/gitleaks-staged --paths "tests/fixtures/keys.json" --reason "The fixture holds a sample key."
gspot ignore secrets/gitleaks-pushed --paths "tests/fixtures/keys.json" --reason "The fixture holds a sample key."
```

## Security checks

| Configuration    | On when                            | What it checks                                                                                                                                         |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `secrets`        | Every repository                   | Gitleaks scans staged changes and pushed commits.                                                                                                      |
| `dependencies`   | Every repository                   | Before each push that changes a lockfile, OSV-Scanner reports packages with known vulnerabilities, as [Dependencies](/topics/dependencies/) describes. |
| `security`       | Every repository                   | Before each push, Semgrep runs the FastAPI rules and your own rule files.                                                                              |
| `docker`         | A Dockerfile or Compose file       | Before each push, Trivy checks your Dockerfiles. `gspot check --only docker/trivy-image` scans the images that your Compose files name.                |
| `github-actions` | A workflow in `.github/workflows/` | Before each commit, zizmor finds unsafe workflows and actions that are not pinned.                                                                     |

## Semgrep

Semgrep runs before each push, on macOS and Linux, when a configuration ships Semgrep rules, as FastAPI does, or when
you add your own. To add your own, list their files, and gspot rejects a path that names no file:

```shell title="example"
gspot set security.semgrep_rules rules/semgrep.yml
```

With neither, gspot does not install Semgrep.
