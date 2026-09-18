---
layer: code
preset: rules
title: Errors
---

# Errors

## Error taxonomy

- An expected operational error (invalid input, missing resource, permission denied, provider timeout) becomes a typed result or a typed error the caller can branch on.
- A programmer error (broken invariant, impossible state) is thrown, logged with its stack, and surfaces as a generic failure. It is never caught to keep going.
- A startup failure fails fast before the process accepts work.
- A fatal runtime error goes through the shutdown path so the supervisor restarts the process.

## Raising and catching

- Throw or raise only the language's error type or a subclass of it. Never strings, numbers, plain objects, or provider payloads.
- Catch the narrowest type. Never a bare catch-all unless the block re-raises or is a deliberate isolation boundary that records the failure.
- Keep the try block around the one operation that can fail.
- Do not catch only to rethrow unchanged.
- Preserve the cause when wrapping: `new Error(message, { cause })`, `raise ... from error`, `Error` conformance with an underlying error.
- Do not swallow failures. A caught error is handled, recorded, or re-raised.
- Do not add speculative handling for states that cannot occur under the real contract.
- Run required cleanup in `finally` or the language's equivalent.

## Error messages

Error messages visible to users, command-line callers, generated artifacts, or logs must not leak internal system details.

**Never include in error messages:**

- Schema names, table names, column names, or function names
- Internal identifiers (row IDs, user IDs, session tokens)
- Stack traces or file paths
- Implementation details (trigger names, policy names, internal state like "deleted" flags)

**Always:**

- Start error messages with an uppercase letter (sentence case)
- Make messages actionable: tell the user what went wrong, not how the system works
- Use generic messages for configuration and infrastructure failures
- Name the value that failed in `name=value` form when it helps debugging and is safe to show
- Keep messages consistent in tone and casing across the repository
- Keep messages easy to grep: stable text, values as arguments

## At boundaries

- Convert technical errors to user-facing messages at the presentation boundary.
- Central error handling owns final formatting; feature code does not format transport errors.
- Client-visible messages are generic and stable. Detail stays in server diagnostics.
- Process-level last-resort handlers (unhandled rejection, uncaught exception) report, mark the process not ready, and exit. They never keep serving.
