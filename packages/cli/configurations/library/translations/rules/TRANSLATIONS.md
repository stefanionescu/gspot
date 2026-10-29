# Translations

Read this rule when you change translated text, locales, or language switching.

## Locales and routing

- Define the supported locales, the default, and the selection logic in one place, with Best Current Practice (BCP) 47
  tags such as `en-GB`.
- Check a locale from a URL, cookie, or header against the supported list before loading messages, and build catalog
  import paths from validated values only. Unsupported input gets the documented default or not-found behavior, not a
  failed dynamic import.
- Choose the routing deliberately. A public site with locale-prefixed URLs needs locale-aware links, redirects,
  canonical URLs, alternate-language metadata, and sitemap entries. An application without indexed locale URLs can pick
  the language by cookie or saved preference.
- Define the precedence among the URL, the saved preference, the negotiated header, and the default, without redirect
  loops.
- A request-local i18n configuration owns resolution; handlers and displayed content use the same locale. Never keep a
  user's locale in mutable server module state. Partition localized data in server, browser, and
  content delivery network (CDN) caches.

## Messages and catalogs

Keys name stable product concepts, so a reader finds the owning feature. Never build a key from an arbitrary server
string, a display name, or an English source sentence.

- Group related messages under one namespace per feature. Share a message only when its meaning and grammatical role
  match everywhere.
- Translators get complete sentences or clauses. Never concatenate translated fragments or pluralize by appending an
  English suffix; use International Components for Unicode (ICU) arguments, plurals, selects, and rich text through the
  library's rendering API.
- Placeholder names belong to the message contract, so a change to one updates every caller and catalog together.
- Rich tags stay stable and map to trusted components. Never accept executable markup from a translator or a provider
  response.
- Translate safe validation and error codes where the application presents them. A raw schema exception, SQL message, or
  provider error does not supply a translation key.
- User-generated content, proper names, identifiers, and developer logs supply interpolation data, not message keys, and
  stay untranslated.

Translate every string the application authors and displays to the user. That covers headings, buttons, placeholders,
toasts, validation errors, accessible names, image alternatives, navigation, metadata, list status controls, and the
empty, error, and loading states.

Translations land in the same change as their call sites; an incomplete locale leaves the supported list instead. Checks
validate catalog structure. Show missing keys during development. Make the production fallback deliberate and visible in
the logs, never a silent `catch` that hides a missing catalog.

## Rendering and formatting

- Use the framework's established i18n library. Translate on the server where it renders, and give each client provider
  the scoped messages its interactive children need. Never send every locale, and never send the whole catalog.
- Format numbers, currencies, dates, relative times, and time zones through locale-aware APIs. Never infer currency or
  time zone from language alone.
- Use an explicit product time-zone policy. Define when relative timestamps refresh.
- Give localized public routes localized metadata, and point each alternate link to the matching resource in that
  locale, including a resource missing in some languages. Never generate an alternate URL that redirects forever or
  describes missing content.

## Changing the language

1. Keep the current resource, the relevant search parameters, and the hash where the routing supports them.
2. Save the preference through the code that validates and stores it, when the product promises to keep it.
3. Navigate through the locale-aware routing, so that server-rendered content, client labels, and metadata agree.
4. Refresh locale-dependent query keys and results. Do not keep translated data under a key without the locale.
5. Keep the focus and the scroll position.
6. Report a failed preference write. Never show a selection that reverts on refresh.

A language menu names each language as its speakers write it, not with a flag. Treat region and currency as separate
choices when the product offers them.

## Right-to-left layout

Set the document's `lang` and `dir` for the active locale. Use logical spacing and alignment properties, and mirror an
icon or image only when its meaning requires it. Focus order and horizontal scrolling follow the direction, and record
data never reverses to display right-to-left (RTL) text.

## Verification

List the default locale, another supported locale, and affected screens for the user to check. Include linguistic
accuracy, dynamic keys, untranslated text, long translations, other writing systems, plural cases, rich text, form
errors, locale selection after refresh, localized navigation, and screen-reader labels. A new RTL locale adds its layout
and mixed-direction text to that list.

## References

Use documentation matching the installed release and enabled features.

| Topic                | Primary source                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- |
| ICU MessageFormat    | [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) |
| next-intl providers  | [next-intl configuration](https://next-intl.dev/docs/usage/configuration)               |
| BCP 47 language tags | [Request for Comments (RFC) 5646](https://www.rfc-editor.org/rfc/rfc5646)               |
