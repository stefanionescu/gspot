# nginx

## nginx and Edge Containers

Rules:

- nginx handles edge concerns: TLS, request body limits, compression, timeout policy, static ACME paths, broad rate limiting.
- Prefer nginx/reverse-proxy compression for high-traffic production. If nginx owns compression, do not also compress the same responses in the application unless the behavior is deliberately tested.
- nginx must not encode product authorization or feature behavior.
- nginx body limits must match application parser limits.
- Health/readiness endpoints may be private/internal if they are not meant for public traffic.
- Keep nginx image tags explicit. Avoid unpinned `nginx:alpine` for production if image reproducibility matters.
