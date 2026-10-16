# Suppressions

Read this rule before you add a suppression comment or run `gspot ignore`.

A suppression turns a lint rule off for one place, and it carries a reason.

- Write the reason on the same line or directly above, in the form `reason: <sentence>.`. The reason says why the
  lint rule misjudges this place.
- A reason states a fact that a reader can check in the repository today. Never cite a plan, a table, a
  conversation, or a decision that the repository does not hold.
- Scope a suppression to the narrowest thing that works: one lint rule, one line, one symbol. A file-wide
  suppression needs a reason that holds for the whole file.
- Suppress only when the lint rule misjudges this line. When the code breaks the lint rule, fix the code.
- Never suppress a size or complexity limit, such as `complexity`, `max-lines`, or `max-statements`. Split the code
  by its steps, or ask the user to raise the limit in `gspot.toml`.
- Do not widen a setting, such as an import boundary or an architecture module, so that a finding passes. Move the
  code instead.
- Do not select a configuration only to stop a detection notice. Remove the configuration from that scope instead.
- Delete a suppression when its cause does not apply. Never add filler statements to pass a check.

The forms differ by language. The same rule holds for all of them: the ESLint disable comment, the Ruff `noqa`, the
type-checker ignore, the SwiftLint disable, and the ShellCheck disable. gspot refuses Semgrep and Vale directives.

To accept a finding without changing the code, ask the user first. Then run `gspot ignore <check>` with a reason.
Every other rule that mentions `[[ignore]]` follows this one.
