# Errors and Logging

## Error Messages

Error messages visible to users, command-line callers, generated model cards, or
logs must not leak internal system details.

**Never include in error messages:**

- Schema names, table names, column names, or function names
- Internal identifiers (row IDs, user IDs, session tokens)
- Stack traces or file paths
- Implementation details (trigger names, policy names, internal state like "deleted" flags)

**Always:**

- Start error messages with an uppercase letter (sentence case)
- Make messages actionable: tell the user what went wrong, not how the system works
- Use generic messages for configuration and infrastructure failures
- Keep messages consistent in tone and casing across the repository

## Logging and Telemetry

Use the central logger from the telemetry boundary. Use structured item fields.
The message string describes the event. Object fields carry searchable metadata.
HTTP request/response logging belongs to `pino-http` middleware; feature code
logs product and provider events.

Rules:

- Do not use `console.log`.
- Application logs go to stdout or stderr through Pino.
- Do not write application logs directly to files, databases, or third-party transports from route/module code.
- Include request trace when available.
- Propagate stable request or correlation IDs to provider calls when supported.
- Keep event names stable.
- Keep Pino logger configuration, redaction, serializers, timestamp/level formatting, and transports in the central telemetry/app assembly owner. Do not configure Pino from feature modules.
- Keep Pino's standard levels: `debug`, `info`, `warn`, `error`, and `fatal`. Do not add project levels unless the logging pipeline is deliberately redesigned.
- Use `debug` for noisy diagnostic details, `info` for normal lifecycle events, `warn` for degraded or retryable conditions, `error` for failed operations, and `fatal` only when the process or a major runtime owner is unusable.
- Put searchable values in the first item argument; keep the message string stable and human-readable.
- Do not put configured IDs, provider messages, user text, or serialized payloads into the log message string.
- Do not instantiate new Pino loggers in modules.
- Do not use `pino-pretty` in deployed environments.
- Do not add Pino transports, OpenTelemetry log forwarding, or observability-vendor wiring without an explicit observability task that defines service name, trace correlation, collector/exporter config, schema, redaction, and deployment ownership.
- Use the reporting owner for exception capture.
- Use the `err` field for `Error` objects so Pino serializes errors consistently.
- Do not log full `req`, `res`, headers, cookies, request bodies, response bodies, provider responses, or DB rows outside the dedicated HTTP logger/reporting owner.
- Do not log raw user content, protocol payloads, tokens, headers, cookies, or full provider payloads.
- Redaction belongs in the central telemetry layer. When a new sensitive key can reach logs or reports, update logger redaction and telemetry scrubbing instead of relying on one-off call-site filtering.
- Request-path logs should include stable correlation fields when available: `requestId`, domain operation IDs, provider `requestId`, and `userId` only when it is safe and needed.
- Keep log object keys stable. Renaming log fields is an observability contract change.
- Avoid large, deeply nested, or expensive-to-compute log fields. Summarize counts, IDs, statuses, provider names, and durations instead.
- Tests for telemetry should assert mandatory fields and redaction, not just that a logger was called.
- Important production signals include error rate, response latency, throughput, saturation, process restarts, provider failures, database failures, and circuit breaker state.

```ts
// Bad: a dynamic message hides searchable fields.
logger.info(`Provider operation ${operationId} started for ${accountId}`);

// Good: stable message, structured fields.
logger.info({ operationId, accountId, requestId: trace.requestId }, 'Provider operation started');
```

```ts
// Bad: full provider response may contain sensitive or huge payloads.
logger.error({ response }, 'Provider operation failed');

// Good: summarize the failure and keep provider request ID.
logger.error(
    {
        err,
        provider: providerName,
        statusCode,
        requestId: providerRequestId,
    },
    'Provider operation failed',
);
```

```ts
logger.error(
    {
        err,
        statusCode: apiError.statusCode,
        path: req.path,
    },
    'Server error',
);
```

```ts
logger.info(
    {
        operationId,
        provider: providerName,
        durationMilliseconds,
        requestId: trace.requestId,
    },
    'Provider operation started',
);
```
