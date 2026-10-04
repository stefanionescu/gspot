---
title: Errors
---

# Errors

## Error taxonomy

- An expected operational error (invalid input, missing resource, permission denied, provider timeout) becomes a typed result or a typed error the caller can branch on.
- A programmer error (broken invariant, impossible state) is thrown, logged with its stack, and surfaces as a generic failure. It is never caught to keep going.
- A startup failure fails fast before the process accepts work.
- On shutdown, set readiness to false, stop accepting work, drain in-flight work for a bounded
  time, close resources, and exit.
- A fatal runtime error stops new work, reports the failure, and exits. Last-resort handlers never
  keep serving.

## Raising and catching

- Catch the narrowest type. Never a bare catch-all unless the block re-raises or is a deliberate isolation boundary that records the failure.
- Keep the try block around the one operation that can fail.
- Preserve the cause when wrapping: `new Error(message, { cause })`, `raise ... from error`, `Error` conformance with an underlying error.
- Do not swallow failures. A caught error is handled, recorded, or re-raised.

- Run required cleanup in `finally` or the language's equivalent.

## Error messages

Public error responses must not disclose private implementation details. A developer tool may
name the file, line, and setting that the user must fix. Keep credentials and unrelated private data out of every output.

**Keep out of public service responses:**

- Schema names, table names, column names, or function names.
- Internal identifiers (row IDs, user IDs, session tokens).
- Stack traces or file paths.
- Raw upstream, provider, or database errors.
- Implementation details (trigger names, policy names, internal state like "deleted" flags).

**Always:**

- Make messages actionable: tell the user what went wrong, not how the system works.
- Put the failing value in its own field, not in the message text.
- Keep messages easy to grep: stable text, values as arguments.

## At boundaries

- Convert technical errors to user-facing messages at the presentation boundary.
- One handler formats error responses. Feature code throws and never builds an HTTP error body.
- Client-visible messages are generic and stable. Detail stays in server diagnostics.

## Message style

<!-- level: all -->

Use sentence case for error messages. Keep their tone and casing consistent across the repository.
Preserve externally owned diagnostic text when callers depend on its exact form.
