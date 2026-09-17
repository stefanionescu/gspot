# Deno

Rules that hold because the code runs on Deno.

## Module resolution

- Internal imports use explicit `.ts` extensions.
- Remote imports are pinned. An unpinned remote import is a supply-chain hole.

## Permissions and APIs

- Deno grants permissions explicitly. Request the narrowest set the code needs and state why.
- `Deno.*` and the web platform APIs are available. Node built-ins are available only through the
  compatibility layer, and using one is a decision worth stating.
