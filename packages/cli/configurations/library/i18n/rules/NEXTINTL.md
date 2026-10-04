---
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

- Use `getTranslations` in async Server Components. Non-async components can use
  `useTranslations`; the library selects its server or client implementation from the render context.
- Keep `now` and `timeZone` identical between the server render and the first browser render so
  formatted dates and relative times hydrate without mismatch.
- Generate `alternates` and `canonical` metadata from the routing definition. Do not hand-write
  locale URLs in metadata.

## Messages

- Handle missing messages through `onError` and choose the visible error text through
  `getMessageFallback`. The default reports an error and returns a key-based fallback.
  Configure client callbacks in a Client Component because functions cannot cross the server boundary.

See [request configuration](https://next-intl.dev/docs/usage/configuration) and
[Server and Client Components](https://next-intl.dev/docs/environments/server-client-components).
