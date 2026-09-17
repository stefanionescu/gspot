---
layer: code
preset: rules
title: Logging
---

# Logging

## One Logger

- One logger owner per process, configured at the entrypoint: level, format, redaction, transports. `unenforced`
- Feature code obtains a logger from that owner. It never instantiates, configures, or adds transports. `unenforced`
- Do not use `console.log`, `print`, or `debugPrint` for application logging. `print` is for a CLI's own stdout output. `enforced-by: typescript/eslint no-console`
- Logs go to stdout or stderr. Files, databases, and third-party transports are wired at the owner, never in feature code. `unenforced`

## Levels

- `debug`: noisy diagnostic detail, off in production. `unenforced`
- `info`: normal lifecycle events and status. `unenforced`
- `warn`: degraded, retryable, or unexpected but survivable conditions. `unenforced`
- `error`: a failed operation that was recorded at an isolation boundary. `unenforced`
- `fatal`: the process or a major owner is unusable and is shutting down. `unenforced`
- Do not add custom levels. `unenforced`

## Structure

- The message string is stable, human-readable, and describes the event. Values go in structured fields, never interpolated into the message. `enforced-by: python/ruff G`
- Event names and field keys are operational contracts in `lower_snake_case`. Renaming one is an observability change. `unenforced`
- Include the request trace when one is available. `unenforced`
- Use stable names for request IDs, correlation IDs, provider request IDs, operation IDs, resource IDs, and safe user IDs. Propagate them to provider calls when supported. `unenforced`
- Put an error object in the field the logger serializes errors from, so stack and cause are kept. `unenforced`
- Summarize: counts, IDs, statuses, provider names, durations. No large, deeply nested, or expensive-to-compute fields. `unenforced`
- Do not compute expensive log arguments when the level is disabled. `unenforced`

## Never Log

- Secrets, tokens, passwords, cookies, authorization headers, connection strings. `enforced-by: security/semgrep`
- Personal data, raw user content, full request or response bodies, provider payloads, database rows. `enforced-by: security/semgrep`
- Anything outside the dedicated HTTP logger or reporting owner that dumps a request or response. `unenforced`

Redaction lives in the logger owner. When a new sensitive key can reach logs, update the redaction list; do not filter at one call site.

## Signals

Production signals to emit: error rate, response latency, throughput, saturation, process restarts, provider failures, database failures, circuit breaker state.

Tests for telemetry assert the mandatory fields and redaction, not that a logger was called.
