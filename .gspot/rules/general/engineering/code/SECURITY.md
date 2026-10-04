---
title: Security
---

# Security

## Input

- Validate every value that crosses a trust boundary before use: request bodies, query strings,
  path parameters, headers, cookies, environment, files, provider responses, queue messages,
  command-line arguments. A type annotation is not validation.
- Bound every input: size, length, count, depth, rate.
- Reject unknown fields in request bodies that create or change data.

## Never build code or paths from input

- No SQL, shell, file path, URL, HTML, regex, dynamic import, or template built by string
  concatenation with untrusted input. Use parameters, argument arrays, path joins against a fixed
  root with traversal checks, URL builders, and escaping owned by the sink.
- No `eval`, `new Function`, string timers, `exec` with a shell, or reflection driven by input.
- Deserialize only formats that cannot execute (JSON, not pickle or YAML with custom tags).

## Web sinks

- Render untrusted content as text. When HTML is required, sanitize it in one module and add a
  suppression with the reason there.
- Reject executable script URLs and untrusted inline code.
- Send security headers: HSTS, `X-Content-Type-Options: nosniff`, frame policy, referrer policy,
  and a Content Security Policy that the application's own scripts satisfy.

## Redirects and outbound requests

- Redirect only to a relative path or an allowlisted origin.
- Outbound fetches to a user-influenced target check the host against an allowlist and reject
  private, loopback, link-local, and metadata addresses, on every hop of a redirect chain.

## Authentication and authorization

- Identity comes from a verified server-side session or token. A client-supplied user ID, role,
  or tenant is data, never authority.
- Authorization runs where data is read or changed, for every entry point (HTTP, RPC, job,
  webhook), and rechecks ownership even when a parent already checked it.
- Compare secrets, signatures, and tokens in constant time.
- Generate tokens, nonces, and reset codes with the platform's cryptographic random source.
- Hash passwords with a current, slow, salted algorithm through a maintained library. Use one
  failure message for unknown user and wrong password.
- Verify webhook signatures against the raw body before decoding, and handle replay with an
  idempotency key.
- Cookies that carry sessions: `HttpOnly`, `Secure`, `SameSite`, explicit `Max-Age`, non-default
  name. Writes never happen on GET.

## Secrets and disclosure

- No default credentials, sample admin users, debug endpoints, or auth bypasses in any build.

## Supply chain

- Verify checksums or signatures of downloaded binaries. Never pipe a download into an interpreter.
