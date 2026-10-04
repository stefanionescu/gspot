---
title: Secrets
---

# Secrets

## Secrets in code and configuration

- Never hardcode API keys, tokens, passwords, or secrets anywhere in the codebase.
- Read a secret from the environment or the platform's secret store, in the configuration module.
- Examples, documentation, and templates hold placeholders, never real secrets.
- A published package lists its files explicitly; an ignored file can still leak through the
  defaults of a packaging tool.
