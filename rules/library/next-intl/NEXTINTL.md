---
layer: library
preset: i18n
title: next-intl
---

# next-intl

Rules for `next-intl` in a Next.js App Router application. The locale, catalog, and RTL rules that
hold for any framework are in the shared i18n rules; these add what the library dictates.

## Configuration

- One request configuration module owns locale resolution, message loading, time zone, and the
  `now` reference. It validates the candidate locale against the supported list before building a
  catalog import path. Nothing else resolves a locale.
- The routing definition (locales, default locale, prefix strategy, pathnames) lives in one module
  that both the proxy and the navigation helpers import.
- Use the library's navigation helpers (`Link`, `redirect`, `usePathname`, `useRouter`) for every
  internal link so locale prefixes and alternate metadata stay correct. Never `next/link` directly
  in a localized route.

## Server and client boundaries

- Translate in Server Components with the async server API. Use the client hook only inside
  Client Components that need interactive translation.
- Give a client provider only the messages its subtree needs, selected by namespace. Never pass
  the whole catalog to every client boundary.
- Keep `now` and `timeZone` identical between the server render and the first browser render so
  formatted dates and relative times hydrate without mismatch.
- Generate `alternates` and `canonical` metadata from the routing definition. Do not hand-write
  locale URLs in metadata.

## Messages

- Keys are stable semantic paths under a feature namespace. ICU arguments, plurals, selects, and
  rich-text tags go through the library's rendering API, never string concatenation.
- Rich-text tags map to trusted components declared at the call site.
- A missing key throws in development and is reported in production through the library's
  `onError` hook. The key name is never a silent fallback.
- Catalogs for every supported locale change in the same commit as the call site.
