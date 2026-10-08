---
title: Deno
---

# Deno

Rules that hold because the code runs on Deno.

## Module resolution

- Relative imports use the real file extension, such as `.ts` or `.js`. Preserve aliases
  resolved by the declared import map.

## Permissions and APIs

- Deno grants permissions explicitly. Request the narrowest set the code needs. Write the reason
  in a comment beside the permission flag.
- `Deno.*` and the web platform APIs are available. Node built-ins use the compatibility layer.
  Write the reason for using one in a comment beside its import.
