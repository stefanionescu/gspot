---
title: Next.js Security
---

# Next.js Security

Runtime boundaries, configuration, authorization, rich content, service workers, telemetry,
and streaming endpoints. Routing, rendering, and caching rules are in the Next.js file. The
Next.js ESLint plugin and the `gspot/no-client-env` rule report a server value read in
a client module. Semgrep reports `dangerouslySetInnerHTML`, raw SQL, and shell strings built
from input, and gitleaks reports a committed secret. This guide holds the decisions those
tools cannot see.

## Boundaries

Authentication identifies the caller, and authorization decides whether that caller may
perform the operation. In a multitenant application, the tenant is the account whose data
and permissions the operation uses. Every Server Action, Route Handler, tRPC procedure, and
externally callable operation is an independent boundary. It authenticates and authorizes at
the data or action owner, because a protected layout, hidden button, request proxy, or
client-side redirect protects nothing.

Identity comes from a verified server session. Reads and writes are restricted to the
caller's resources and tenants, and no browser-provided role or user ID is trusted.
Row-level security adds checks. Admin clients stay restricted to operations that need their
authority and are never exposed through a shared provider or browser module. Signed-out
callers, another user's resource, another tenant, and revoked access are tested as negative
integration cases, and the deployed application's controls are exercised.

Bodies, query strings, path parameters, cookies, uploads, cursors, and provider responses are
validated and bounded. File type and content are checked where uploads exist. A raw string
does not become safe because TypeScript calls it an ID. Secrets live in server configuration,
validated with a clear failure when absent. `NEXT_PUBLIC_*` values are public and substituted
at build time, and server configuration is not exported through a shared barrel.

Responses expose safe DTO fields and stable error codes. Logs hold no session tokens,
authorization headers, passwords, private messages, full sensitive bodies, or provider
credentials, while keeping correlation IDs and safe context. Writes stay out of GET. Custom
cookie-authenticated writes carry CSRF protection through the framework's Server Action and
origin checks. CORS controls browser access to responses without replacing authentication,
and credentialed cross-origin requests are allowed from required origins only.

Route Handlers use the right method, status, and content type and parse failures safely.
They verify webhook signatures against the raw body before processing, with replay and
idempotency handled, and rate-limit costly public operations through deployment-shared
state. Redirect destinations and external fetch targets a user can influence are allowlisted.
Internal addresses and every hop of a redirect chain are checked against SSRF. Untrusted
input is validated and passed through safe APIs before SQL, shell commands, HTML rendering,
or navigation.

User content renders as text or through a reviewed sanitizer. A Content Security Policy and
the other security headers are configured and verified against the real rendering and
scripts. Cancellation and deadlines propagate to streaming and provider work, so a
disconnected browser leaves no expensive work running. Partial stream failure is handled
apart from completion, and retries and fan-out are bounded.

Request state is isolated across instances, and each cache's contents are defined. Sessions,
uploads, jobs, files, and rate limits live in storage several instances can see. Node, Edge,
static export, and adapter support are checked before choosing runtime features. Scanner
findings are investigated, with each suppression scoped to a reviewed finding.

## Configuration and bundles

Private values stay out of the `env` option of `next.config.*`, which exposes configured
values to client bundles whatever their names. Secrets are read from server runtime
configuration. A browser value goes through an explicit public variable or a reviewed public
DTO. The process environment is never spread into build options, bundler definitions,
generated JavaScript, or HTML. The composed configuration, including wrappers, imported
fragments, and deployment substitutions, is inspected because a browser-only lint cannot see
build-time injection.

When a secret boundary changes, the production browser output is verified with harmless
marker values, never real credentials. A credential that once shipped in an asset is revoked
rather than merely unreferenced. Type and lint failures stay visible, with no
`ignoreBuildErrors` or `ignoreDuringBuilds`. Next, its ESLint configuration, React, the
adapter, and bundler plugins align with the installed majors. See
[configuration environment variables](https://nextjs.org/docs/app/api-reference/config/next-config-js/env).

A redirect in a layout or proxy improves navigation and is never the only access check. The
operation may be called directly, from another route, or after a session change, so access
is rechecked where protected data is read or changed. Where the auth library ships a
framework integration, it is used alone, not combined with the older "Auth Helpers" package
in one flow. Browser and request-scoped server clients stay distinct. A client-side
`getSession()` read supplies a transport token and no server authorization. Session refresh
with response cookies stays out of read-only RSC context creation.

Expired and revoked sessions are real transitions. They clear browser caches and keep stale
private views from returning through Back navigation. See
[server-side auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs).

## Rich content and editors

Markdown parsing is not sanitization, and `marked` leaves it to the caller. User and provider
messages pass through one reviewed content boundary. That is a renderer that rejects raw HTML
or a maintained sanitizer with a defined allowlist, applied to the final HTML after every
transformation and before any sink. It covers links, image sources, inline event attributes,
frames, SVG, and dangerous URL schemes. Regex replacements, type assertions, and
trusted-looking model output make nothing safe.

`dangerouslySetInnerHTML` is confined to a reviewed rendering adapter with its sanitization
tests beside it and a narrow suppression naming the sanitizer or the exact static source. The
same policy covers streaming partial messages and persisted messages. An asynchronous parse
never overwrites newer text or another message.

Tiptap initializes in a Client Component with the installed version's SSR behavior,
`immediatelyRender: false` where required, and compatible extension versions. Updates stay
editor transactions rather than full-document `setContent` calls that disturb selection,
history, and composition. Submission waits for an active IME composition to end. Enter,
Shift+Enter, mobile keyboards, multiline paste, undo, and the empty-to-nonempty transition
are tested. The saved representation (editor JSON, HTML, or plain text) and its size limits
are defined, and an extension schema does not make saved HTML trusted. See
[Tiptap for Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs).

## Service workers, media, and telemetry

A service-worker cache is another cache owner that HTTP headers and query invalidation do not
clear. It stores only intended public assets. Authenticated API responses, chat content,
personalized RSC payloads, signed media URLs, and private media stay out unless a deliberate
private offline feature defines storage, expiry, logout, and account switching. Worker routes
match real URLs, methods, origins, and paths, because a broad image suffix can catch
authenticated media. Cache versioning and activation are defined and tested against a
controlled tab during update, offline reload, logout, account switch, and Back navigation. A
new worker discards no unsaved draft.

Object storage authorizes the bucket and object path in database and storage policies,
tested with another user's object and every preview or transformed variant. Signed URLs are
bearer access with expiry. They stay out of telemetry and shared caches, are refreshed within
bounds, and are cleared with account-scoped state at logout. Large media uses an authorized
delivery mechanism rather than base64 through query caches. It is tested for range requests,
expiry during playback, interrupted loads, and memory with several visible videos. Listeners,
preloads, and object URLs are cleaned up so a late load event cannot mark a new source loaded.

Browser analytics has one initialization owner, and server routes use server-compatible
telemetry rather than a browser SDK module. Allowed event properties are defined so chat
transcripts, editor content, auth inputs, tokens, signed URLs, and private identifiers are
masked from autocapture and session replay. Captured payloads are verified, including custom
and contenteditable controls. Analytics identity resets on logout and account switch, with
anonymous-to-authenticated changes explicit.

Telemetry failure never replaces an operation's response, and diagnostic code never throws
while handling the original failure. Awaited logging is bounded through the runtime's
deferred-work lifecycle. An SDK's returned error field is checked as well as thrown
exceptions; `resend.emails.send` returns `{ data, error }`. Success is returned only after
confirming the provider result, and acceptance is distinct from delivery. Email recipients,
sender identity, and `reply-to` are restricted on the server, with abuse controls on public
feedback and OTP operations.

## Endpoints and streaming

Each Route Handler defines allowed body size, content types, methods, validation,
authorization, error responses, and caching, and it checks data before processing it. Each
stream defines the signal that confirms completion, distinct from an open connection or
partial data. The client represents partial output, completion, cancellation, timeout, and
failure after output has started, with a defined point to save and merge the result.

An abort signal propagates upstream. Total work, token and media size, concurrency, and
request lifetime are bounded. Readers, timers, subscriptions, and provider resources are
released on every outcome including disconnect, and no detached promise keeps producing
after cancellation. Temporary browser output keeps its relationship to persisted entities so
a retry does not duplicate the durable operation. Provider and user output pass the same
content policy, and public streams carry no error details or serialized upstream exceptions.

A raw streaming handler uses the Web Streams API with a defined wire format and sets content
type, cache policy, and headers before returning. It respects backpressure with bounded
queues and supported piping or pull-based production. It parses the application format
independently of network chunks, with incremental UTF-8 decoding and retained partial
records. It defines framing for SSE or newline-delimited JSON rather than assuming one
`enqueue` per read. It closes file handles and upstream readers per the runtime's ownership
rules and streams large files incrementally. A late failure is reported through the stream
protocol or by closing the stream, never by appending a second response.

An SSE consumer uses an established parser where available and dispatches an event only on a
complete separator. It supports the protocol's line endings, comments, and multiline `data:`
fields, and validates the parsed payload. It flushes the decoder at end of input and treats
a closed socket without the required terminal event as incomplete. Buffered bytes are
bounded. Tests cover split multibyte characters, split JSON, several frames per read, missing
terminal events, malformed frames, and cancellation during a blocked read.

An inference proxy, retrieval request, and usage-verification endpoint are separate callable
operations. Each verifies access and enforces its own budget before using a privileged
credential. A protected page or a prior chat-creation mutation protects no other endpoint.
Resource ownership and allowed model and provider choices derive on the server. Input bytes,
context count, per-message size, output tokens, duration, and concurrency are bounded.
Browser token estimates and disabled buttons are feedback, not quota.

Private prompts and retrieved passages stay out of query strings, referrers, and analytics
URLs. Retrieved text and generated output are untrusted data. They authorize no tool call,
select no credential, and override no access check, and structured provider results are
validated before use as identifiers. Generation and persistence have one owner. When
generation succeeds and saving fails, persistence retries under the same operation identity
instead of generating and charging again. Quota and concurrency use shared state across
instances, tested with direct signed-out requests, another user's chat, oversized contexts,
excessive output, retries, and concurrent submissions.

Streaming is measured through the production adapter, proxy, CDN, and compression, because a
chunking server can sit behind a buffering layer. Host streaming support and execution
limits are checked; static export cannot stream at request time, and `X-Accel-Buffering: no`
is not a universal control. Compression flushing is compared with an
`Accept-Encoding: identity` request. Timestamps cover request start, headers, body reads, and
completion rather than starting after `fetch()` resolves. Progressive visible content is
inspected alongside timed reads.

Chunk boundaries are transport details that need not match Suspense boundaries or require
`Transfer-Encoding: chunked` on HTTP/2. Slow data, slow networks, cancellation, mid-stream
errors, and crawler requests are verified with usable final content, metadata, and status.
Evidence is observable timing and visibility rather than private React payload syntax.
