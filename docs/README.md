# The gspot Manual

The user manual for gspot uses Astro Starlight. The reference loader in
`src/content/reference.ts` derives pages from the CLI and plugin definitions. The guides are authored Markdown.

## Setup

```bash
mise run repo:setup
mise run docs:build
```

From the repository root or `docs/`, `mise run docs:dev` serves the site locally.
The reference loader preserves authored pages and rejects duplicate page identities.

Build and deployment checks live in `scripts/`: `links.ts` validates the built pages, and
`verify-release.ts` checks that a deployment matches its release.
