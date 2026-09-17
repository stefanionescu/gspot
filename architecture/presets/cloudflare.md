# cloudflare

Kind: platform. Requires: javascript or typescript, config-files.

## Detects and claims

| | |
| --- | --- |
| Detect | `wrangler.jsonc`, `wrangler.toml`, `functions/_middleware.js`, `functions/_worker.js`, `_headers`, `_redirects`, `@opennextjs/cloudflare` in dependencies |
| Claims | `wrangler.*`, `functions/**`, `_headers`, `_redirects`, `cloudflare-env.d.ts` (generated), `.open-next/**` (build output, untracked) |
| Architecture it assumes | Pages Functions under `functions/` and the two underscore files, because Cloudflare reads them there |

## Tools

wrangler, zizmor is not relevant; the Semgrep landing pack for workers.

## Generated configuration

The files this preset claims get the `worker` runtime (the rule in [javascript.md](javascript.md)), so the scope's ESLint config gains worker globals (`Response`, `Request`, `fetch`, `caches`) for
`functions/**` and `_worker.*`.

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `cloudflare/wrangler-config` | commit | `wrangler.*` validates against the published schema |
| `cloudflare/headers-syntax` | commit | `_headers` parses: a path line followed by indented header lines |
| `cloudflare/redirects-syntax` | commit | `_redirects` parses: source, destination, optional status |
| `integrity/security-headers` | commit | `_headers` sets `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`; HTML paths carry a revalidating `Cache-Control`; hashed assets are immutable |
| `cloudflare/env-types-fresh` | push | `wrangler types` leaves `cloudflare-env.d.ts` unchanged |
| `security/semgrep` workers pack | push | no wildcard CORS origin, no unvalidated `request.json()`, no DOM HTML sinks, no user-controlled fetch |

## Settings

`tools.cloudflare.required_headers` (name, value pattern), `tools.cloudflare.html_paths`.

## Rule files

`runtime/workers/WORKERS.md`; `tool/github-actions/GITHUB-ACTIONS.md` when workflows deploy.
