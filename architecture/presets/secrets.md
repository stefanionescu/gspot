# `secrets`

Kind: concern. Requires: nothing. Selected by default in every repository.

## Claims

The whole tree, including binaries, and vendored files.

## Tools

gitleaks, trufflehog.

## Generated configuration

| Target                          | Holds                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.gspot/gitleaks.toml`          | `[extend] useDefault = true`; allowlists from `[tools.gitleaks] allow` (paths, regexes, reason); baseline path |
| `.gspot/gitleaks-baseline.json` | reviewed historical findings, each with a reason in `[tools.gitleaks] baseline_reasons`                        |

## Checks

| Id                            | Stage  | Command                                                                                                                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `secrets/gitleaks-staged`     | commit | `gitleaks git --staged --config .gspot/gitleaks.toml --redact`                                                                                               |
| `secrets/gitleaks`            | push   | `gitleaks git --config .gspot/gitleaks.toml --baseline-path .gitleaks-baseline.json --redact` over the pushed range                                          |
| `secrets/trufflehog`          | push   | `trufflehog git file://. --since-commit <base> --results=verified --fail`                                                                                    |
| `integrity/env-files`         | commit | no environment file staged except templates. The shipped pattern list is `.env*` and Wrangler's `.dev.vars*`; a preset adds a pattern as data, never as code |
| `integrity/gitleaks-baseline` | commit | every baseline fingerprint has a reason and names a path that existed                                                                                        |
| `config-files/dotenv`         | commit | tracked `.env*` files hold keys only                                                                                                                         |

## Settings

`tools.gitleaks.allow` (description, paths, regexes, reason), `tools.gitleaks.baseline_reasons`
(fingerprint, reason), `tools.trufflehog.verified_only` (default true).

## Rule files

`general/code/SECRETS.md`, `general/code/SECURITY.md`.
