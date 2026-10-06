---
title: Suppressions
---

# Suppressions

A suppression turns a rule off for one place, and it carries a reason.

- Write the reason on the same line or directly above, in the form `reason: <sentence>.`. It says
  why the rule does not apply here, not what the rule is.
- Scope a suppression to the narrowest thing that works: one rule, one line, one symbol. A
  file-wide suppression needs a reason that is true of the whole file.
- Suppress only when the rule is wrong for this line. When the code breaks the rule, fix the code.
  To turn a rule off across the project, change policy through `gspot ignore` within the user's request.
- Delete a suppression whose cause is gone. Never add filler statements to pass a check.

The forms differ by language, and the rule is the same in all of them. The forms are the ESLint
disable comment, the Ruff `noqa`, the type-checker ignore, the SwiftLint disable, the ShellCheck
disable. Semgrep and Vale directives are refused. Record their findings with `gspot ignore`.

To accept a finding without touching the code, record it with `gspot ignore <check>` and a reason.
The ignore names the check, the rule, and the paths, and every report lists it.
