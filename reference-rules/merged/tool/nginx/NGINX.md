---
layer: tool
preset: nginx
title: nginx
---

# nginx

## Edge Responsibilities

- nginx handles edge concerns: TLS, request body limits, compression, timeout policy, static
  ACME paths, broad rate limiting, security headers. `enforced-by: nginx/config-test`
- nginx must not encode product authorization or feature behavior. `enforced-by: nginx/config-test`
- Prefer nginx compression for high-traffic production. If nginx owns compression, the
  application does not also compress the same responses. `enforced-by: nginx/config-test`
- nginx body limits equal the application parser limits. `enforced-by: nginx/config-test`
- Health and readiness endpoints are private or internal when they are not meant for public
  traffic. `enforced-by: nginx/config-test`

## Configuration

- One `server` block per hostname. Redirect the plain-HTTP server to HTTPS and every alias to
  the canonical host. `enforced-by: nginx/config-test`
- `server_tokens off`. No version in error pages or headers. `enforced-by: nginx/config-test`
- TLS: `ssl_protocols TLSv1.2 TLSv1.3`, a modern cipher list from the platform's generator,
  `ssl_session_tickets off`, OCSP stapling on. `enforced-by: nginx/config-test`
- Security headers on every response: `Strict-Transport-Security`, `X-Content-Type-Options
  nosniff`, `X-Frame-Options` or a frame-ancestors CSP, `Referrer-Policy`, and the application's
  `Content-Security-Policy`. Set them once in a shared include. `enforced-by: nginx/config-test`
- `client_max_body_size` per location, matching the application route limits, with a small
  default. `enforced-by: nginx/config-test`
- Timeouts (`proxy_read_timeout`, `proxy_connect_timeout`, `send_timeout`) are explicit and align
  with the application's shutdown grace period. `enforced-by: nginx/config-test`
- Rate-limit zones are named for what they protect (`zone=login_attempts`) and sized with a
  comment stating the budget. `enforced-by: nginx/config-test`
- Proxy headers forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-ID`; the
  application trusts them only from this proxy. `enforced-by: nginx/config-test`
- Static assets are served with immutable caching when hashed and no caching when not. `enforced-by: nginx/config-test`
- Configuration lives in the repository, is linted in the gate, and is reloaded through the
  deployment flow, never edited on the host. `enforced-by: nginx/config-test`

## Images

- Pin the nginx image to a full version tag (`nginx:<MAJOR.MINOR.PATCH>-alpine`), never
  `nginx:alpine` or `latest`. `enforced-by: nginx/config-test`
- The image copies the configuration and nothing else. No shell in the entrypoint. `enforced-by: nginx/config-test`
