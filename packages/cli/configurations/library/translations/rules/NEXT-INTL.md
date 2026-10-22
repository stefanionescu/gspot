# next-intl

Read this rule when you change next-intl configuration or messages.

## Configuration

- One request configuration module owns locale resolution, message loading, time zone, and the `now` reference. Nothing
  else resolves a locale.
- Define routing in one module: locales, default locale, prefix strategy, and pathnames that both the proxy and the
  navigation helpers import.
- Use the library's navigation helpers such as `Link`, `redirect`, `usePathname`, and `useRouter` for every internal
  link so locale prefixes and alternate metadata stay correct. Never use `next/link` directly in a localized route.

## Server and client boundaries

- Use `getTranslations` in async Server Components. Non-async components can use `useTranslations`; the library picks
  its server or client implementation from the render context.
- Keep `now` and `timeZone` identical between the server and the first browser render, so formatted dates and relative
  times hydrate without mismatch.
- Generate `alternates` and `canonical` metadata from the routing definition. Do not hand-write locale URLs in metadata.
- A `NextIntlClientProvider` that a Server Component renders inherits every message by default, and a nested provider
  replaces the `messages` of its ancestor instead of merging them. Pick the messages at the provider that owns the
  subtree.

## Messages

- Handle missing messages through `onError` and choose the visible error text through `getMessageFallback`. The default
  reports an error and returns a key-based fallback. Configure client callbacks in a Client Component because functions
  cannot cross the server boundary.

See [request configuration](https://next-intl.dev/docs/usage/configuration) and
[Server and Client Components](https://next-intl.dev/docs/environments/server-client-components).
