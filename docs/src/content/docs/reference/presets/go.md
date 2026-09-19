---
title: "Go"
description: "Go source and modules: gofmt, golangci-lint with a strict rule set, govulncheck, a tidy go.mod, and ceilings on file and function length."
---

Go source and modules: gofmt, golangci-lint with a strict rule set, govulncheck, a tidy go.mod, and ceilings on file and function length.

Kind: language. Requires: `structure`, `formatting`.

## Tools

- go
- gofmt
- golangci-lint 2.13.2
- govulncheck 1.8.0

## Generated configuration

- `.gspot/golangci.yml`

## Checks

| Check                                                        | Stage  | What it finds                                                                                            |
| ------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| [`go/gofmt`](/reference/rules/go/gofmt/)                     | commit | Checks that every Go file is formatted the way gofmt formats it.                                         |
| [`go/golangci-lint`](/reference/rules/go/golangci-lint/)     | commit | Runs golangci-lint with the linters the preset turns on, the type check of go vet among them.            |
| [`go/mod-tidy`](/reference/rules/go/mod-tidy/)               | commit | Checks that go mod tidy changes neither go.mod nor go.sum.                                               |
| [`go/govulncheck`](/reference/rules/go/govulncheck/)         | push   | Runs govulncheck, which reports a known vulnerability only where the code calls the vulnerable function. |
| [`go/file-length`](/reference/rules/go/file-length/)         | commit | Checks that no Go file has more code lines than the ceiling.                                             |
| [`go/function-length`](/reference/rules/go/function-length/) | commit | Checks that no Go function or method has more lines than the ceiling.                                    |

## Settings

- `tools.golangci.disabled`: Linters the repository turns off: the name and the reason.

## Rule files

- `language/GO.md`
