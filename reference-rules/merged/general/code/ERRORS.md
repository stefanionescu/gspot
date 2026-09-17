---
layer: code
preset: rules
title: Errors
---

# Errors

## Error Taxonomy

- An expected operational error (invalid input, missing resource, permission denied, provider timeout) becomes a typed result or a typed error the caller can branch on. `unenforced`
- A programmer error (broken invariant, impossible state) is thrown, logged with its stack, and surfaces as a generic failure. It is never caught to keep going. `unenforced`
- A startup failure fails fast before the process accepts work. `unenforced`
- A fatal runtime error goes through the shutdown path so the supervisor restarts the process. `unenforced`

## Raising and Catching

- Throw or raise only the language's error type or a subclass of it. Never strings, numbers, plain objects, or provider payloads. `enforced-by: typescript/eslint @typescript-eslint/only-throw-error`
- Catch the narrowest type. Never a bare catch-all unless the block re-raises or is a deliberate isolation boundary that records the failure. `enforced-by: python/ruff BLE001`
- Keep the try block around the one operation that can fail. `unenforced`
- Do not catch only to rethrow unchanged. `enforced-by: typescript/eslint sonarjs/no-useless-catch`
- Preserve the cause when wrapping: `new Error(message, { cause })`, `raise ... from error`, `Error` conformance with an underlying error. `enforced-by: python/ruff B904`
- Do not swallow failures. A caught error is handled, recorded, or re-raised. `enforced-by: typescript/eslint no-empty`
- Do not add speculative handling for states that cannot occur under the real contract. `unenforced`
- Run required cleanup in `finally` or the language's equivalent. `unenforced`

## Error Messages

Error messages visible to users, command-line callers, generated artifacts, or logs must not leak internal system details.

**Never include in error messages:**

- Schema names, table names, column names, or function names `enforced-by: security/semgrep`
- Internal identifiers (row IDs, user IDs, session tokens) `enforced-by: security/semgrep`
- Stack traces or file paths `enforced-by: security/semgrep`
- Implementation details (trigger names, policy names, internal state like "deleted" flags) `enforced-by: security/semgrep`

**Always:**

- Start error messages with an uppercase letter (sentence case) `enforced-by: python/ruff EM`
- Make messages actionable: tell the user what went wrong, not how the system works `unenforced`
- Use generic messages for configuration and infrastructure failures `unenforced`
- Name the value that failed in `name=value` form when it helps debugging and is safe to show `unenforced`
- Keep messages consistent in tone and casing across the repository `unenforced`
- Keep messages easy to grep: stable text, values as arguments `enforced-by: security/semgrep`

## At Boundaries

- Convert technical errors to user-facing messages at the presentation boundary. `unenforced`
- Central error handling owns final formatting; feature code does not format transport errors. `unenforced`
- Client-visible messages are generic and stable. Detail stays in server diagnostics. `enforced-by: security/semgrep`
- Process-level last-resort handlers (unhandled rejection, uncaught exception) report, mark the process not ready, and exit. They never keep serving. `unenforced`
