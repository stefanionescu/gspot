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
  catalog import path. Nothing else resolves a locale. `enforced-by: integrity/locales`
- The routing definition (locales, default locale, prefix strategy, pathnames) lives in one module
  that both the proxy and the navigation helpers import. `enforced-by: integrity/locales`
- Use the library's navigation helpers (`Link`, `redirect`, `usePathname`, `useRouter`) for every
  internal link so locale prefixes and alternate metadata stay correct. Never `next/link` directly
  in a localized route. `enforced-by: integrity/locales`

## Server and client boundaries

- Translate in Server Components with the async server API. Use the client hook only inside
  Client Components that need interactive translation. `enforced-by: integrity/locales`
- Give a client provider only the messages its subtree needs, selected by namespace. Never pass
  the whole catalog to every client boundary. `enforced-by: integrity/locales`
- Keep `now` and `timeZone` identical between the server render and the first browser render so
  formatted dates and relative times hydrate without mismatch. `enforced-by: integrity/locales`
- Generate `alternates` and `canonical` metadata from the routing definition. Do not hand-write
  locale URLs in metadata. `enforced-by: integrity/locales`

## Messages

- Keys are stable semantic paths under a feature namespace. ICU arguments, plurals, selects, and
  rich-text tags go through the library's rendering API, never string concatenation. `enforced-by: integrity/locales`
- Rich-text tags map to trusted components declared at the call site. `enforced-by: integrity/locales`
- A missing key throws in development and is reported in production through the library's
  `onError` hook. The key name is never a silent fallback. `enforced-by: integrity/locales`
- Catalogs for every supported locale change in the same commit as the call site. `enforced-by: integrity/locales`
