# The gspot Manual

The user manual for gspot, built with Astro Starlight. The reference pages are written by
`reference-pages.ts` from the same data the binary carries; the guides are written by hand.

## Setup

```bash
bun install
bun --cwd docs run build
```

`bun --cwd docs run dev` serves the site locally. `bun docs/reference-pages.ts --check` says whether the
reference pages match the binary; the gate runs it as `docs/generated`.
