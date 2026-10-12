# Suppressions

A suppression turns a rule off for one place, and it carries a reason.

- Write the reason on the same line or directly above, in the form `reason: <sentence>.`. It says
  why the rule does not apply here, not the content of the rule.
- Scope a suppression to the narrowest thing that works: one rule, one line, one symbol. A
  file-wide suppression needs a reason that applies to the whole file.
- Suppress only when the rule misjudges this line. When the code breaks the rule, fix the code.
- Delete a suppression with no remaining cause. Never add filler statements to pass a check.

The forms differ by language. Apply the same rule to all of them: the ESLint
disable comment, the Ruff `noqa`, the type-checker ignore, the SwiftLint disable, the ShellCheck
disable. gspot refuses Semgrep and Vale directives.

To accept a finding without changing the code, run `gspot ignore <check>` with a reason. Ask the user first.
