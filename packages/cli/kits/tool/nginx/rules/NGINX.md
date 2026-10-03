---
title: nginx
---

# nginx

## Edge responsibilities

- nginx handles edge concerns: TLS, request body limits, compression, timeout policy, static
  ACME paths, broad rate limiting, security headers.
- nginx must not encode product authorization or feature behavior.
- Prefer nginx compression for high-traffic production. If nginx owns compression, the
  application does not also compress the same responses.
- nginx body limits equal the application parser limits.
- Health and readiness endpoints are private or internal when they are not meant for public
  traffic.

## Configuration

- One `server` block per hostname. Redirect the plain-HTTP server to HTTPS and every alias to
  the canonical host.
- `server_tokens off`. No version in error pages or headers.
- TLS: `ssl_protocols TLSv1.2 TLSv1.3`, a modern cipher list from the platform's generator,
  and an explicit session-ticket policy. Enable OCSP stapling only when the certificate issuer
  supports it and its response can be verified.
- Security headers on every response: `Strict-Transport-Security`,
  `X-Content-Type-Options nosniff`, `X-Frame-Options` or a frame-ancestors CSP, `Referrer-Policy`,
  and the application's `Content-Security-Policy`. Set them once in a shared include.
- `client_max_body_size` per location, matching the application route limits, with a small
  default.
- Timeouts (`proxy_read_timeout`, `proxy_connect_timeout`, `send_timeout`) are explicit and align
  with the application's shutdown grace period.
- Rate-limit zones are named for what they protect (`zone=login_attempts`) and sized with a
  comment stating the budget.
- Set proxy headers according to the upstream trust contract. Overwrite untrusted client
  values where required. The application trusts forwarding metadata only from approved proxies.
- Use immutable caching only for content-addressed assets. Give mutable resources a cache
  lifetime and revalidation policy consistent with how they are updated.
- Configuration lives in the repository, is linted before commit, and is reloaded through the
  deployment flow, never edited on the host.

## Images

- Pin the nginx image to a full version tag (`nginx:<MAJOR.MINOR.PATCH>-alpine`), never
  `nginx:alpine` or `latest`.
- The image copies the configuration and nothing else. No shell in the entrypoint.

See [nginx TLS configuration](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_stapling)
for stapling requirements. Certificate authorities can
[retire OCSP](https://letsencrypt.org/2024/12/05/ending-ocsp); verify issuer support
before enabling stapling.
