# NGINX

Read this rule when you change nginx configuration.

## Edge responsibilities

- Keep product authorization and feature behavior out of nginx.

## Configuration

- One `server` block per hostname. Redirect the plain-HTTP server to HTTPS and every alias to the canonical host.
- TLS: `ssl_protocols TLSv1.2 TLSv1.3`, a modern cipher list from the platform's generator, and an explicit
  session-ticket policy.
- Put the application's security-header directives in one shared include. Use `always` where a header must also appear
  on error responses.
- `client_max_body_size` per location, matching the application route limits, with a small default.
- Set explicit `proxy_read_timeout`, `proxy_connect_timeout`, and `send_timeout` values that align with the
  application's shutdown grace period.
- Name rate-limit zones for what they protect, such as `zone=login_attempts`, and size them with a comment stating the
  budget.
- Set proxy headers according to the upstream trust contract. Overwrite untrusted client values where required. The
  application trusts forwarding metadata only from approved proxies.
- Use immutable caching only for content-addressed assets. Give mutable resources a cache lifetime and revalidation
  policy consistent with their update process.
- Keep configuration in the repository, lint it before commit, and reload it through the deployment flow; never edit it
  on the host.

## Images

- Pin the nginx image to a full version tag of the variant the project uses, never `nginx:alpine` or `latest`.
- The image copies the configuration and nothing else. No shell in the `ENTRYPOINT`.
