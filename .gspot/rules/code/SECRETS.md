---
title: Secrets
---

# Secrets

## Secrets in code and configuration

- Never hardcode API keys, tokens, passwords, or secrets anywhere in the codebase.
- Read secrets through the declared environment, protected file, platform binding, or secret store.
  Keep access controls and logging restrictions at that boundary.
- Never put real secrets in OpenAPI examples.
- Never put real secrets in `.env.example`.
- A published package lists its files explicitly; an ignored file can still leak through the
  defaults of a packaging tool.

## Secrets in logs

Never log API keys, provider tokens, auth headers, bearer tokens, database
service-role keys, reporting tokens, raw user content, full request bodies with
auth headers, or full provider payloads.

- Treat user content as sensitive.
- Scrub before logging or reporting.

```ts
// Bad.
logger.info({ headers: req.headers }, 'Incoming request');

// Good.
logger.info({ path: req.path, method: req.method, requestId }, 'Incoming request');
```
