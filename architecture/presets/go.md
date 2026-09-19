# `go`

Kind: language. Requires: structure, formatting. Recommends: spelling, dependencies, security.

## Detects and claims

|        |                                            |
| ------ | ------------------------------------------ |
| Detect | `go.mod`, `.go` files                      |
| Claims | `.go`, `go.mod`, `go.sum`, `.golangci.yml` |

## Tools

go and gofmt from the host, golangci-lint 2.13.2, govulncheck 1.8.0 through the mise `go:` backend.

The repository owns its Go toolchain: `go.mod` names the version, and the `go` command fetches it.

## Generated configuration

`.gspot/golangci.yml`, version 2 of the format. `default: none`, then 34 linters by name, so a new
release of golangci-lint turns nothing on by itself. `cyclop` and `gocognit` sit at 8 and `nestif`
at 4, the ceilings the other languages hold. `errcheck` also reads type assertions and blank
assignments.

`govet` runs every analyzer except `fieldalignment`. `nolintlint` wants a linter name
and an explanation on every `//nolint`. `relative-path-mode: wd` makes a finding name its file from
the scope, where the check runs, and not from the folder of the configuration.

No stub is written: golangci-lint has no `extends`, and the check passes `--config`.

## Checks

| Id                   | Stage         | Command                                                                                        |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `go/gofmt`           | commit        | `gofmt -l`; the fixer runs `gofmt -w`                                                          |
| `go/golangci-lint`   | commit        | `golangci-lint run --config .gspot/golangci.yml --output.json.path stdout ./...`, in the scope |
| `go/mod-tidy`        | commit        | `go mod tidy -diff`: a diff is a finding                                                       |
| `go/file-length`     | commit        | code lines against `limits.file_lines` for go                                                  |
| `go/function-length` | commit        | functions and methods on the Go grammar, against `limits.function_lines` for go                |
| `go/govulncheck`     | push, network | `govulncheck ./...`; one finding for each vulnerability the code reaches, with the fix         |

The rule of a `go/golangci-lint` finding is the linter, so a baseline and an ignore name one linter.
The rule of a `go/govulncheck` finding is the vulnerability id.

## Settings

`tools.golangci.disabled` (the linter and the reason), `limits.file_lines` and
`limits.function_lines` for go.

## Rule files

`language/GO.md`.
