---
layer: agent
configuration: rules
title: Suppressions
---

# Suppressions

A suppression turns a rule off for one place. Every one is counted and every one carries a reason.

- Every suppression comment carries a reason on the same line or directly above it, in the form
  `reason: <sentence>.`
- The reason says why the rule does not apply here, not what the rule is.
- Scope a suppression to the narrowest thing that works: one rule, one line, one symbol. A
  file-wide suppression needs a reason that is true of the whole file.
- Do not suppress a rule to make a failing gate pass. Fix the code, or change the rule for
  everyone and say so.
- Do not leave a suppression whose cause is gone. A suppression that suppresses nothing is a
  finding of its own.
- No ticket field exists. A field nobody fills honestly is worse than no field.

Every language has its own syntax for this, and the rule is the same in all of them. The forms are
the ESLint disable comment, the Ruff `noqa`, the type-checker ignore, the SwiftLint disable, the
ShellCheck disable, and the Semgrep suppression.
