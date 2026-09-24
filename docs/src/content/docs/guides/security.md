---
title: Run security checks
description: Run the Swift security rules and a configured CodeQL analysis.
---

Use the [source installation guide](/guides/install/) to prepare the CLI. Run the commands below
from the repository root unless a step names another directory.

## Swift security rules

Select `security` with `swift` to run the iOS Semgrep pack at push. It checks Keychain
accessibility, secret storage, credential literals, insecure network settings, and weak
hashes. It also checks unsafe pointer operations, web views, sensitive logging, and
JavaScript build-script injection. Plist files participate in the security check.
The generated pack is `.gspot/config/semgrep/ios.yml`.

## CodeQL analysis

In a repository with the `security` configuration selected, add the languages to scan in `gspot.toml`:

```toml
[tools.codeql]
languages = ["python"]
```

Run these commands from the repository root:

```bash
gspot apply
gspot install
gspot check --stage manual --only security/codeql --no-cache
```

CodeQL runs against a disposable copy of the selected sources. Findings use repository-relative
paths. The security configuration pins the CLI and its matching query packs; the first scan downloads
missing packs. An unreadable report or failed native analysis returns status 2. Repair the
reported tool failure before treating the scan as complete.
