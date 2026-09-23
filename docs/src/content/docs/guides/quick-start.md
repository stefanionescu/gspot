---
title: Run your first check
description: Reproduce a Bash syntax finding in a disposable folder, correct it, and run the check again.
---

Start from a [source checkout with dependencies installed](/guides/install/). This example
uses Bun 1.3.11 and Bash on `PATH`; it was captured with
gspot 0.1.0 on macOS arm64. It selects only Bash syntax, so no broad tool installation is needed.

## Prepare a disposable folder

Use the `gspot` shell function from the installation procedure. In that shell, create the example:

```bash
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
Bash version. The [landing page](/#finding) shows the complete captured output.
Only Bash syntax was checked.

## Correct and rerun

Replace the contents of `greet.sh`:

```bash
printf 'printf "%%s\\n" "Hello"\n' > greet.sh
gspot check --only bash/syntax --no-cache
```

The command exits 0 and reports `1 check passed, 0 checks failed`. The edit fixes the syntax
error manually; `bash/syntax` has no automatic fixer.

The inputs and captured output live in
[docs/src/components/bash-syntax.json](https://github.com/stefanionescu/gspot/blob/main/docs/src/components/bash-syntax.json).
To reproduce in your own project, keep the project files and run `gspot init` without the
example-specific exclusions. Run `gspot install` before checks that need the locked tools.
