---
layer: code
preset: rules
title: Security
---

# Security

## Input

- Validate every value that crosses a trust boundary before use: request bodies, query strings,
  path parameters, headers, cookies, environment, files, provider responses, queue messages,
  command-line arguments. A type annotation is not validation. `enforced-by: security/semgrep`
- Bound every input: size, length, count, depth, rate. `enforced-by: security/semgrep`
- Reject unknown fields on write contracts. `enforced-by: security/semgrep`

## Never build code or paths from input

- No SQL, shell, file path, URL, HTML, regex, dynamic import, or template built by string
  concatenation with untrusted input. Use parameters, argument arrays, path joins against a fixed
  root with traversal checks, URL builders, and escaping owned by the sink. `enforced-by: security/semgrep`
- No `eval`, `new Function`, string timers, `exec` with a shell, or reflection driven by input. `enforced-by: security/semgrep`
- Deserialize only formats that cannot execute (JSON, not pickle or YAML with custom tags). `enforced-by: security/semgrep`

## Web sinks

- Untrusted content reaches the DOM as text, or through one reviewed sanitizer with an allowlist.
  Never through `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, or
  `dangerouslySetInnerHTML` outside that adapter. `enforced-by: structure/html-scripts`
- No inline scripts, inline event handlers, or `javascript:` URLs. `enforced-by: structure/html-scripts`
- Send security headers: HSTS, `X-Content-Type-Options: nosniff`, frame policy, referrer policy,
  and a Content Security Policy that the application's own scripts satisfy. `enforced-by: integrity/security-headers`

## Redirects and outbound requests

- Redirect only to a relative path or an allowlisted origin. `enforced-by: security/semgrep`
- Outbound fetches to a user-influenced target check the host against an allowlist and reject
  private, loopback, link-local, and metadata addresses, on every hop of a redirect chain. `enforced-by: security/semgrep`

## Authentication and authorization

- Identity comes from a verified server-side session or token. A client-supplied user ID, role,
  or tenant is data, never authority. `unenforced`
- Authorization runs where data is read or changed, for every entry point (HTTP, RPC, job,
  webhook), and rechecks ownership even when a parent already checked it. `unenforced`
- Compare secrets, signatures, and tokens in constant time. `enforced-by: security/semgrep`
- Generate tokens, nonces, and reset codes with the platform's cryptographic random source. `enforced-by: security/semgrep`
- Hash passwords with a current, slow, salted algorithm through a maintained library. Use one
  failure message for unknown user and wrong password. `enforced-by: security/semgrep`
- Verify webhook signatures against the raw body before decoding, and handle replay with an
  idempotency key. `enforced-by: security/semgrep`
- Cookies that carry sessions: `HttpOnly`, `Secure`, `SameSite`, explicit `Max-Age`, non-default
  name. Writes never happen on GET. `enforced-by: security/semgrep`

## Secrets and disclosure

- No secret in source, configuration files, examples, tests, logs, error messages, URLs, build
  arguments, image layers, or commit history. `enforced-by: secrets/gitleaks`
- Error responses and logs carry no stack trace, file path, schema name, internal ID, or raw
  upstream error. `enforced-by: secrets/gitleaks`
- No default credentials, sample admin users, debug endpoints, or auth bypasses in any build. `enforced-by: secrets/gitleaks`

## Supply chain

- Pin dependencies and actions exactly; install with a frozen lockfile; respect the minimum release
  age; scan in the gate. `enforced-by: integrity/install-policy`
- Verify checksums or signatures of downloaded binaries. Never pipe a download into an interpreter. `enforced-by: integrity/install-policy`
