---
layer: code
configuration: rules
title: Secrets
---

# Secrets

## Secrets in code and configuration

- Never hardcode API keys, tokens, passwords, or secrets anywhere in the codebase.
- Use environment variables for all secrets. Reference them through config modules, not directly in business logic.
- Never put real secrets in OpenAPI examples.
- Never put real secrets in `.env.example`.
- If package publishing is ever introduced, use an explicit package file allowlist; ignored files can still leak through packaging defaults.

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

## Protect secrets and personal information

Documentation is public by default. Treat every committed example, screenshot,
output block, and URL as publishable.

Never include:

- Real access tokens.
- API keys.
- Passwords.
- Session cookies.
- Private keys.
- Webhook secrets.
- Production connection strings.
- Private IP addresses when they reveal infrastructure.
- Customer data.
- Personal email addresses.
- Internal-only URLs.
- Unredacted request or response headers.
- Live credentials hidden in image metadata.

Use unmistakable placeholders:

```text
<ACCESS_TOKEN>
<PROJECT_ID>
<DATABASE_URL>
<YOUR_DOMAIN>
```

Use angle brackets so a reader can see the replacement boundary. Use uppercase
words joined by underscores. Explain each placeholder before or immediately
after the example.

Do not use a realistic token-shaped value that a scanner or reader can mistake
for a credential.

Use reserved example domains:

```text
https://example.com
https://api.example.com
https://service.example.net
```

Use documentation-only IP address ranges when an address is required. Do not
copy an address from a real environment.

Before adding a screenshot:

1. Replace names, email addresses, IDs, and tokens with example data.
1. Remove irrelevant browser tabs, notifications, and account details.
1. Inspect the image for metadata that must not be published.
1. Confirm that blurring cannot be reversed. Prefer replacing the source text.

Examples that mutate or delete data must use an obviously isolated resource and
must place the risk before the command.
