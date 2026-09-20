---
title: You got a finding, now what
description: Read it, explain it, fix it, or ignore it with a reason.
sidebar:
    order: 3
---

Every finding is one line: the file, the line, the check, the message, and a `help:` line that
says what to do.

```text
src/routes/turn.ts:41:3  gspot/no-call-through  This function passes its arguments straight through to buildTurn.
    help: Call buildTurn directly and delete this function, or give it real work.
```

## Read it

`gspot explain <check>` prints what the check looks for, what goes wrong without it, and what to
do. For a rule inside a tool, `gspot explain <tool>/<rule>` prints the same and the exact
`gspot ignore` and `gspot set` lines that change it.

## Fix it

`gspot check --fix` runs every fixer that can fix its own findings (formatters, import sorters,
codemods) and then the checks again. What it changed is in the working tree, not staged.

A missing tool or failed correction makes the command fail even if the checks pass afterward.
Read the fixer diagnostic and review any partial edits before running it again. A successful
correction counts as a change only when the selected files have different bytes.

## Ignore it with a reason

```bash
gspot ignore typescript/eslint --rule no-console --paths "scripts/**" --reason "Scripts print to the terminal on purpose."
```

An ignore without a reason is refused. Every ignore prints on every run, so nobody forgets it is
there. `gspot ignore --remove` takes it back out.

## Loosen a limit

```bash
gspot set limits.function_lines 80 --reason "The parser is one state machine."
```

A loosening takes a reason; a tightening does not.
