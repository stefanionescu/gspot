---
title: Security
description: The security checks gspot runs, and how to run Semgrep, the Swift security rules, and CodeQL.
---

Four kits carry security checks. Select the ones your repository needs:

| Kit            | Checks                                                                                                      | Stage                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `secrets`      | Gitleaks scans staged changes and pushed commits. TruffleHog confirms candidate secrets with their issuers. | Commit and push                                   |
| `dependencies` | The Open Source Vulnerabilities (OSV) scanner checks your lockfiles for known vulnerable packages.          | Push                                              |
| `security`     | Semgrep runs the shipped rules and your own.                                                                | Push                                              |
| `security`     | Semgrep runs the public rule packs you choose, and CodeQL runs its queries.                                 | Manual                                            |
| `docker`       | Trivy checks the container configuration and an image you name.                                             | See the [Docker checks](/reference/kits/docker/). |

`gspot explain <check>` prints what a check needs to run. A check whose tool is missing fails,
so a missing scanner never looks like a clean scan.

If gspot finds a real secret, revoke or rotate it first, then remove it from the code. Deleting
the line leaves the secret in Git history.

## Semgrep

With the `security` kit, run the shipped rules and your own:

```shell
gspot check --stage push --only security/semgrep
```

Add your rule files with `tools.semgrep.rules`. To run public rule packs, list them in
`tools.semgrep.registry` and run:

```shell
gspot check --stage manual --only security/semgrep-registry
```

The rule packs need network access. To turn a rule off for some paths, record an ignore with a
reason; see [the policy file](/guides/customize/#record-one-exception).

## Swift security rules

With the `security` and `swift` kits, Semgrep runs an iOS rule pack at the push stage. It checks
Keychain access, secret storage, credentials in code, network settings, and weak hashes. It also
checks unsafe pointer operations, web views, sensitive logging, and script injection in build
phases. Plist files are part of the check. The pack is `.gspot/config/semgrep/ios.yml`.

## CodeQL

With the `security` kit, name the languages to scan in `gspot.toml`:

```toml
[tools.codeql]
languages = ["python"]
```

Then apply, install, and run the scan:

```bash
gspot apply
gspot install
gspot check --stage manual --only security/codeql --no-cache
```

CodeQL scans a copy of your sources, and the findings name paths in your repository. The
`security` kit pins the CodeQL CLI and its query packs. The first scan downloads the packs. When
the analysis fails or its report cannot be read, the check exits with `2`.
