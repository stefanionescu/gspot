# Secrets

- Never hardcode API keys, tokens, passwords, or secrets anywhere in the codebase.
- Read secrets from the environment or a secret store in one configuration module. A secret has
  no fallback or default value.
- Never pass a secret in a command-line flag; other processes can read the process arguments.
- Builds copy public build-time variables such as `NEXT_PUBLIC_*` and `VITE_*` into the bundle. They hold
  nothing secret.
- Examples, documentation, templates, and sample files hold placeholders, never real secrets.
- Keep actual local overrides in an ignored file.
- Never log secrets, tokens, passwords, cookies, authorization headers, or connection strings.
- A published package lists its files explicitly; an ignored file can still leak through the
  defaults of a packaging tool.
