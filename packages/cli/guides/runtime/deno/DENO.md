---
layer: runtime
kit: supabase
title: Deno
---

# Deno

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules that hold because the code runs on Deno.

## Module resolution

- Relative imports use the real file extension, such as `.ts` or `.js`. Preserve aliases
  resolved by the declared import map.
- Remote imports are pinned. An unpinned remote import is a supply chain hole.

## Permissions and APIs

- Deno grants permissions explicitly. Request the narrowest set the code needs and state why.
- `Deno.*` and the web platform APIs are available. Node built-ins are available only through the
  compatibility layer, and using one is a decision worth stating.
