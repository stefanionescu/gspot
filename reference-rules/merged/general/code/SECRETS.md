---
layer: code
preset: rules
title: Secrets
---

# Secrets

## Secrets in Code and Configuration

- Never hardcode API keys, tokens, passwords, or secrets anywhere in the codebase. `enforced-by: secrets/gitleaks`
- Use environment variables for all secrets. Reference them through config modules, not directly in business logic. `enforced-by: secrets/gitleaks`
- Never put real secrets in OpenAPI examples. `enforced-by: secrets/gitleaks`
- Never put real secrets in `.env.example`. `enforced-by: secrets/gitleaks`
- If package publishing is ever introduced, use an explicit package file allowlist; ignored files can still leak through packaging defaults. `unenforced`

## Secrets in Logs

Never log API keys, provider tokens, auth headers, bearer tokens, database `enforced-by: secrets/gitleaks`
service-role keys, reporting tokens, raw user content, full request bodies with
auth headers, or full provider payloads.

- Treat user content as sensitive. `unenforced`
- Scrub before logging or reporting. `unenforced`

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

- Real access tokens. `enforced-by: secrets/gitleaks`
- API keys. `enforced-by: secrets/gitleaks`
- Passwords. `enforced-by: secrets/gitleaks`
- Session cookies. `unenforced`
- Private keys. `unenforced`
- Webhook secrets. `enforced-by: secrets/gitleaks`
- Production connection strings. `unenforced`
- Private IP addresses when they reveal infrastructure. `unenforced`
- Customer data. `unenforced`
- Personal email addresses. `unenforced`
- Internal-only URLs. `unenforced`
- Unredacted request or response headers. `unenforced`
- Live credentials hidden in image metadata. `enforced-by: secrets/gitleaks`

Use unmistakable placeholders:

```text
<ACCESS_TOKEN>
<PROJECT_ID>
<DATABASE_URL>
<YOUR_DOMAIN>
```

Use angle brackets so a reader can see the replacement boundary. Use uppercase `unenforced`
words joined by underscores. Explain each placeholder before or immediately
after the example.

Do not use a realistic token-shaped value that a scanner or reader could mistake `enforced-by: secrets/gitleaks`
for a credential.

Use reserved example domains:

```text
https://example.com
https://api.example.com
https://service.example.net
```

Use documentation-only IP address ranges when an address is required. Do not `unenforced`
copy an address from a real environment.

Before adding a screenshot:

1. Replace names, email addresses, IDs, and tokens with example data. `enforced-by: secrets/gitleaks`
1. Remove irrelevant browser tabs, notifications, and account details. `unenforced`
1. Inspect the image for metadata that must not be published. `unenforced`
1. Confirm that blurring cannot be reversed. Prefer replacing the source text. `unenforced`

Examples that mutate or delete data must use an obviously isolated resource and
must place the risk before the command.
