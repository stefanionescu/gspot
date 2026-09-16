# Working with internationalization

Use these rules for messages, catalogs, locale navigation, and localized rendering.

Tests and verification commands in this guide apply only when the user explicitly requests them.
Do not create or update tests, run checks, or add verification infrastructure during ordinary implementation.

## Contents

- [Internationalization](#internationalization)
- [Message ownership and catalog shape](#message-ownership-and-catalog-shape)
- [Select a locale and update navigation](#select-a-locale-and-update-navigation)
- [Localized rendering and metadata](#localized-rendering-and-metadata)
- [References](#references)

## Internationalization

Internationalization (i18n) lets an application support different languages and regional formats. A
locale identifies the language and formatting conventions to use. Message catalogs contain the
translated text. ICU MessageFormat provides placeholders, plurals, and selection rules within those
messages. Right-to-left (RTL) languages also require corresponding layout and interaction behavior.

- Define supported locales, the default locale, and locale selection in one place. Use BCP 47
  language tags, such as `en-GB`. Check locale values from URLs, cookies, and headers against the
  supported list before loading messages. Build catalog import paths from validated values only.
- Choose routing deliberately. Locale-prefixed public sites need locale-aware links, redirects,
  canonical URLs, alternate-language metadata, and sitemap entries. Cookie-based language selection
  is valid for applications that do not need separately indexed locale URLs. Define precedence among
  URL, saved preference, negotiated header, and default; do not create redirect loops.
- Use the established i18n library; prefer `next-intl` for new Next.js localization that fits its
  model. Use server translation APIs for async Server Components and client hooks inside Client
  Components. Pass translated labels or scoped messages where possible. Do not ship the entire
  catalog to every client boundary just because a provider supports it.
- Translate all application-authored user-facing content: headings, buttons, empty/error/loading
  states, placeholders, validation errors, toasts, accessible names, image alternatives, navigation,
  metadata, and list status controls. User-generated content, proper names, IDs, and developer logs
  have separate contracts; do not blindly translate them.
- Use stable semantic keys and complete messages. Do not concatenate translated fragments, pluralize
  by appending an English suffix, or use English source sentences as unstable identifiers. Use ICU
  arguments, plurals, selects, and rich text through the library's rendering API. Keep markup
  callbacks trusted.
- Catalogs agree on nested leaf keys, variable roles, and rich-text tags. ICU must parse and include
  required fallback branches. Plural categories may differ by locale. Translation checks validate
  structure and contracts, not linguistic accuracy. Add translations in the same change as their
  call sites.
- Format numbers, currencies, dates, relative time, and time zones through locale-aware APIs. Do not
  infer currency or time zone solely from language. Keep a consistent initial time/time-zone
  reference across server and browser so hydration matches. Define refresh behavior for relative
  timestamps.
- Set the document's `lang` and `dir` for the selected locale. Use logical spacing and alignment
  properties so they adapt to text direction. Test supported RTL locales. Mirror an icon or image
  only when its meaning requires it. Check that long translations and different writing systems fit
  controls, and remeasure virtual rows while preserving the anchor.
- Language changes update server-rendered content, client labels, metadata where relevant, and
  locale-dependent query keys. Preserve the current resource and URL state. Persist preferences
  through a validated write boundary. Do not show a successful selection while the request failed.
- Localized data is partitioned correctly in server, browser, and CDN caches. Never store a user's
  locale in mutable server module state. A request-local i18n configuration owns resolution.
- Make missing-key behavior visible during development. Any production
  fallback is intentional and observable, not a silent `catch` that hides missing catalogs. Invalid
  locales get the documented default or not-found behavior, not an arbitrary dynamic import failure.
- Verify default and another supported locale, long text, plural cases, rich text, form failures,
  persisted selection after refresh, localized navigation, and screen-reader labels. For new locale
  support, include translator review and layout QA. RTL is required when the supported locale set
  needs it.

Validate catalog key equality, nonempty string leaves, ICU syntax, variables, select options, and
rich tags while preserving language-specific plural categories. Configure the loader for the
application's catalog format and namespace layout. Review hardcoded UI text, dynamic key resolution,
and translation meaning alongside browser verification.

### Message ownership and catalog shape

Translation keys describe stable product concepts. Their names should let a reader find the owning
feature and understand where a message is used. Do not construct keys from arbitrary server strings
or use a display name as a namespace.

- Group related messages under a consistent namespace. Share a message only when its meaning and
  grammatical role are the same everywhere it is used.
- Pass complete sentences or clauses to translators. Word order and pluralization vary; assembling
  fragments in code prevents correct translation.
- Treat placeholder names as part of the message contract. Changing a placeholder requires changing
  all callers and catalogs together.
- Use explicit plural/select constructs for grammatical variants. Locale-specific plural categories
  can differ while still requiring the same input value.
- Keep semantic rich tags stable and map them to trusted UI components. Do not accept arbitrary
  executable markup from a translator or provider response.
- Translate safe validation/error codes at the presentation owner. A raw schema exception, SQL
  message, or provider error is not a user-facing translation key.
- Keep nontranslatable values such as user-authored names and resource IDs as interpolation data
  rather than trying to turn them into message identifiers.

Catalog completeness is part of the same change as the UI. Do not introduce a new message in the
default locale and leave other supported locales to an unspecified future task. If a locale is
intentionally not ready, update the supported-locale contract rather than claiming that an
incomplete catalog is supported.

### Select a locale and update navigation

Choose which locale source takes precedence before adding middleware or proxy logic. A public site
with locale-prefixed URLs normally uses the locale in the URL. A private application can use a saved
preference and choose a default for a new session. Use the chosen locale consistently in request
handling and displayed content.

Validate the candidate locale against a fixed supported set before selecting a catalog. Negotiation
can normalize supported language tags, but it must not turn arbitrary cookie/header input into a
filesystem path. Unsupported input follows one consistent fallback or not-found policy.

When changing language:

1. Preserve the current resource, relevant search parameters, and hash where the navigation strategy
   supports them.
2. Persist the preference through the established validated write owner when the product promises
   persistence.
3. Refresh or navigate through the locale-aware routing mechanism so server and browser content
   agree.
4. Reconcile locale-dependent query results rather than retaining translated data under an identity
   that does not include locale.
5. Preserve a sensible focus and scroll position. Re-measure virtual rows after text metrics change.
6. Surface a failed preference write honestly. Do not show a completed state when the language will
   unexpectedly revert on refresh.

A flag is not an adequate language name or accessible label. Use a clear language label, commonly
including its native name, and separate region/currency selection when those are actual product
choices. Do not assume one flag covers all speakers of a language or that choosing a language
determines currency and time zone.

### Localized rendering and metadata

Translate server-rendered content on the server. Give each client provider the messages and settings
its interactive children need. Load the selected locale's messages rather than sending every locale
to the browser for a language menu.

Dates and relative times require special care. A server and browser can format the same timestamp
differently because their default time zones or clocks differ. Use an explicit product time-zone
policy and a consistent initial reference time. For relative labels, define when they refresh; do
not recreate the whole virtual list every second just to update one timestamp.

Localized public routes need localized metadata and a coherent canonical/alternate strategy. Verify
that links point to the corresponding resource in each locale, including when a resource is
unavailable in some languages. Do not generate alternate URLs that redirect forever or describe
content that does not exist.

RTL support includes layout direction, logical margins/padding, text alignment, icons with
directional meaning, focus order, and horizontal scrolling behavior. Do not reverse record data
merely to display RTL text. Test mixed-direction user content such as identifiers and URLs within
translated sentences.

## References

Use documentation matching the installed release and enabled features.

| Topic                                  | Primary source                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| next-intl server and client boundaries | [next-intl environments](https://next-intl.dev/docs/environments/server-client-components) |
| ICU messages and rich translation      | [next-intl translations](https://next-intl.dev/docs/usage/translations)                    |
