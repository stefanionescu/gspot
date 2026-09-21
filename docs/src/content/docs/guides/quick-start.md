---
title: Run your first check
description: Reproduce a Bash syntax finding in a disposable folder, correct it, and run the check again.
---

Start from a [source checkout with dependencies installed](/guides/install/). Public packages
are not available yet. This example uses Bun 1.3.11 and Bash on `PATH`; it was captured with
gspot 0.1.0 on macOS arm64. It selects only Bash syntax, so no broad tool installation is needed.

## Prepare a disposable folder

From the gspot source checkout, define a shell function that keeps pointing to the source CLI:

```bash
gspot_source="$PWD/packages/cli/src/main.ts"
gspot() { bun "$gspot_source" "$@"; }
example_directory="$(mktemp -d)"
cd "$example_directory"
printf 'if then\n' > greet.sh
```

The folder is outside your project. It contains a deliberately broken Bash statement.

## Review the setup

```bash
gspot init --presets bash --no-hooks --no-ci --no-runner --no-rules --no-install
```

Read the plan, then accept it. Initialization writes `gspot.toml`, generated configuration,
matching tool locks, and a version pin. These flags omit hooks, CI, a task runner, agent rules,
and tool installation for this narrow demonstration. Initialization runs no checks.

If you decline the plan, no configuration is applied. In your own repository, use
[the adoption guide](/guides/existing-repository/) before accepting changes.

## Read the failure

```bash
gspot check --only bash/syntax --no-cache
```

The command exits 1. The captured finding begins:

```text
greet.sh:1  bash/syntax  syntax error near unexpected token `then'
    help: Open the file at the line bash names and fix the quoting, bracket, or keyword it complains about.
```

Bash also echoes the invalid statement in a second diagnostic. Its wording can vary with the
Bash version. The [landing page](/#finding) shows the complete captured output, including the
notice that other files were not checked. A selected check passing does not imply every check passed.

## Correct and rerun

Replace the contents of `greet.sh`:

```bash
printf 'printf "%%s\\n" "Hello"\n' > greet.sh
gspot check --only bash/syntax --no-cache
```

The command exits 0 and reports `passed: 1 check`. This is a manual correction. The example
does not claim the syntax error has an automatic fixer.

The inputs and captured output live in
[examples/bash-syntax.json](https://github.com/stefanionescu/gspot/blob/main/examples/bash-syntax.json).
To reproduce in your own project, keep the project files and run `gspot init` without the
example-specific exclusions. Run `gspot install` before checks that need the locked tools.

## Join a configured repository

Cloning does not install the CLI. Prepare the matching CLI version first, then run:

```bash
gspot install
gspot check
```

Install consumes matching tool locks. If policy and locks disagree, ask the policy owner to
run `gspot apply` and share the resulting changes. Do not regenerate policy as an installation
step. Read [troubleshooting](/guides/troubleshooting/) if tools or version pins disagree.
