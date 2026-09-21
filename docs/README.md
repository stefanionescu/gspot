# The gspot Manual

The user manual for gspot, built with Astro Starlight. The reference pages are written by
`reference-pages.ts` from the same data the binary carries; the guides are written by hand.

## Setup

```bash
mise run repo:setup
mise run docs:build
```

From the repository root or `docs/`, `mise run docs:dev` generates the reference and serves the site locally. Builds generate
reference pages from the CLI definitions; generated pages are not committed. The generator
preserves authored files and refuses to overwrite an authored page at a generated path.
