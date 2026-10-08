---
title: Documentation Surfaces
---

# Documentation Surfaces

Use the contract owner's exact names and values. Document a public surface without requiring the
reader to inspect its implementation. Link one authoritative reference instead of copying it.

## Public contracts

<!-- level: all -->

A CLI reference covers input, output, status, working directory, permissions, and side effects.
An API reference covers identity, allowed inputs, safe outputs, failures, pagination, and limits.
A library reference covers lifecycle, concurrency, errors, and compatibility as well as types.
A configuration reference states scope, precedence, defaults, secrets, and reload behavior.

Show configuration examples with their parent keys. Distinguish missing, empty, and null values
when their effects differ. Explain a required environment variable's format and failure behavior
without publishing a credential.

## Failures and lifecycle

Begin troubleshooting with an observable symptom. Diagnose common, least-destructive causes first;
a reset is not the first answer. Reproduce relevant public errors exactly and redact private data.

## Change communication

<!-- level: all -->

Describe a release by its effect on the reader and any required action. A known issue states its
trigger, risk, and verified workaround. A deprecation states support, replacement, and migration;
a retirement states what is unavailable. Security disclosures follow the project's disclosure
policy and contain only authorized details.

## References

See [CLI documentation](https://clig.dev/#documentation)
and [API reference comments](https://developers.google.com/style/api-reference-comments).
