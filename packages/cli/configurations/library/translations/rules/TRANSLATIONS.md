# Translations

Read this rule when you change translated text, locales, or language switching.

Internationalization, or i18n, lets an application support different languages and regional formats.
A locale names the language and formatting conventions, message catalogs hold the translated text,
and International Components for Unicode (ICU) MessageFormat adds placeholders, plurals, and selection to messages.

## Locales and routing

- Define the supported locales, the default locale, and locale selection in one place, with Best Current Practice (BCP) 47
  tags such as `en-GB`.
- Check a locale from a URL, cookie, or header against the supported list before loading messages,
  and build catalog import paths from checked values only. Unsupported input gets the documented
  default or not-found behavior, not a failed dynamic import.
- Choose the routing deliberately. A public site with locale-prefixed URLs needs locale-aware links,
  redirects, canonical URLs, alternate-language metadata, and sitemap entries. An application
  without indexed locale URLs can select the language by cookie or saved preference.
- Define the precedence among the URL, the saved preference, the negotiated header, and the
  default, without redirect loops.
- A request-local i18n configuration owns resolution, and request handling and displayed content
  use the same locale. Never keep a user's locale in mutable server module state, and partition
  localized data in server, browser, and content delivery network (CDN) caches.

## Messages and catalogs

Keys name stable product concepts, so a reader finds the owning feature. Never build a key from an
arbitrary server string, a display name, or an English source sentence.

- Group related messages under one namespace per feature. Share a message only when its meaning
  and grammatical role match everywhere.
- Translators get complete sentences or clauses. Never concatenate translated fragments or
  pluralize by appending an English suffix; use ICU arguments, plurals, selects, and rich text
  through the library's rendering API.
- Placeholder names belong to the message contract, so a change to one updates every caller and
  catalog together.
- Rich tags stay stable and map to trusted components. Never accept executable markup from a
  translator or a provider response.
- Translate safe validation and error codes where the application presents them. A raw schema exception, SQL
  message, or provider error does not supply a translation key.
- User-generated content, proper names, identifiers, and developer logs supply interpolation data,
  not message keys, and stay untranslated.

Translate every application-authored string the application displays to the user. That covers headings, buttons,
placeholders, toasts, validation errors, accessible names, image alternatives, navigation,
metadata, list status controls, and the empty, error, and loading states.

Plural categories can differ by locale while every locale takes the same input value. Configure
the catalog loader for the application's format and namespace layout.

Translations land in the same change as their call sites; an incomplete locale leaves the
supported list instead. Checks validate catalog structure. List the locales and screens for the
user to check for linguistic accuracy, dynamic keys, and untranslated UI text. Show missing keys during development. Make the production fallback deliberate and visible in the logs, never
a silent `catch` that hides a missing catalog.

## Rendering and formatting

- Use the framework's established i18n library. Translate on the server where rendering happens
  there, and give each client provider the scoped messages its interactive children need, never
  every locale or the whole catalog.
- Format numbers, currencies, dates, relative times, and time zones through locale-aware APIs.
  Never infer currency or time zone from language alone.
- Use an explicit product time-zone policy. Define when relative timestamps refresh.
- Localized public routes get localized metadata, and each alternate link points to the matching
  resource in that locale, including a resource missing in some languages. Never generate an
  alternate URL that redirects forever or describes missing content.

## Changing the language

1. Keep the current resource, the relevant search parameters, and the hash where the routing supports them.
2. Save the preference through the code that validates and saves it, when the product promises to keep it.
3. Navigate through the locale-aware routing, so that server-rendered content, client labels, and metadata agree.
4. Refresh locale-dependent query keys and results. Do not keep translated data under a key without the locale.
5. Keep the focus and the scroll position.
6. Report a failed preference write. Never show a selection that reverts on refresh.

A language menu names each language with a clear label, commonly its native name, not a flag.
Treat region and currency as separate choices when the product offers them.

## Right-to-left layout

Set the document's `lang` and `dir` for the selected locale. List supported right-to-left (RTL)
locales and affected screens for the user to check. Use logical spacing and alignment properties, and mirror an icon or image only when
its meaning requires it. Focus order and horizontal scrolling follow the direction, and record data
never reverses to display RTL text. Add translated sentences that hold identifiers or URLs to that list, because their text directions mix.

## Verification

List the default locale, another supported locale, and affected screens for the user to check.
Include long translations, other writing systems, plural cases, rich text, form errors, locale
selection after refresh, localized navigation, and screen-reader labels. A new RTL locale adds its
layout and mixed-direction text to that list.

## References

Use documentation matching the installed release and enabled features.

| Topic                | Primary source                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- |
| ICU MessageFormat    | [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) |
| BCP 47 language tags | [Request for Comments (RFC) 5646](https://www.rfc-editor.org/rfc/rfc5646)               |
