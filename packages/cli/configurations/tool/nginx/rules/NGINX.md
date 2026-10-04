---
title: nginx
---

# nginx

## Edge responsibilities

- nginx must not encode product authorization or feature behavior.

## Configuration

- One `server` block per hostname. Redirect the plain-HTTP server to HTTPS and every alias to
  the canonical host.
- TLS: `ssl_protocols TLSv1.2 TLSv1.3`, a modern cipher list from the platform's generator,
  and an explicit session-ticket policy. Enable OCSP stapling only when the certificate issuer
  supports it and its response can be verified.
- Put the application's security-header directives in one shared include. Use `always` where a
  header must also appear on error responses.
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

- Pin the nginx image to a full version tag of the variant the project uses, never `nginx:alpine`
  or `latest`.
- The image copies the configuration and nothing else. No shell in the entrypoint.

See [nginx TLS configuration](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_stapling)
for stapling requirements. Certificate authorities can
[retire OCSP](https://letsencrypt.org/2024/12/05/ending-ocsp); verify issuer support
before enabling stapling.
