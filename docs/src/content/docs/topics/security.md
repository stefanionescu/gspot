---
title: Security
configurations: [security, docker, github-actions, secrets, pyjwt, machine-learning]
---

gspot scans each commit and each push for secrets. A push that changes a lockfile also looks up the locked packages for
known vulnerabilities, and Semgrep runs when a configuration or your settings give it rules.

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

| Configuration    | On when                            | What it checks                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secrets`        | Every repository                   | Gitleaks scans staged changes and pushed commits.                                                                                                                                                                                                                                                                                                             |
| `dependencies`   | Every repository                   | Before each push that changes a lockfile, OSV-Scanner reports packages with known vulnerabilities, as [Dependencies](/topics/dependencies/) describes.                                                                                                                                                                                                        |
| `security`       | Every repository                   | Before each push, Semgrep runs the FastAPI rules and your own rule files.                                                                                                                                                                                                                                                                                     |
| `docker`         | A Dockerfile or Compose file       | Before each commit, gspot reports a piped download, a second Python index, an `ADD` of a URL with no checksum, a privileged service, a mounted Docker socket, and a turned-off seccomp, AppArmor, or SELinux profile. Before each push, Trivy checks your Dockerfiles. `gspot check --only docker/trivy-image` scans the images that your Compose files name. |
| `github-actions` | A workflow in `.github/workflows/` | Before each commit, zizmor finds unsafe workflows and actions that are not pinned, and gspot reports a download piped into a shell in `run:` and a secret in the top-level `env`.                                                                                                                                                                             |

## Semgrep

Semgrep runs before each push, on macOS and Linux, when a configuration ships Semgrep rules, or when you list rule files of
your own. With neither, gspot does not install it. [FastAPI](/frameworks/fastapi/), [Django](/frameworks/django/), and
[Flask](/frameworks/flask/) ship rules for request handlers, and these two configurations ship rules for Python
libraries:

| Configuration      | On when                                                                                        | Reports                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pyjwt`            | The project depends on `PyJWT`                                                                 | A decode that skips the signature check, the `none` algorithm, and a signing key written in the source.                                                                                    |
| `machine-learning` | The project depends on `torch`, `transformers`, `huggingface-hub`, `joblib`, or `scikit-learn` | `torch.load` with `weights_only=False`, `numpy.load` with `allow_pickle=True`, and `trust_remote_code=True`. Level `all` adds `joblib.load` and hub downloads without a pinned `revision`. |

gspot rejects a rule file path that names no file:

```shell title="example"
gspot set security.semgrep_rules rules/semgrep.yml
```
