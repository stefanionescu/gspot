---
layer: framework
configuration: nextjs
title: Next.js Security
---

# Next.js Security

Runtime boundaries, configuration, authorization, rich content, service workers, telemetry, and
streaming endpoints. Routing, rendering, and caching rules are in the Next.js file.

## Next.js security and runtime boundaries

Authentication identifies the caller. Authorization checks whether that caller can perform the
requested operation. In a multitenant application, a tenant is the account or organization whose
data and permissions the operation uses.

- Treat every Server Action, Route Handler, tRPC procedure, and externally callable operation as an
  independent boundary. Authenticate and authorize at the data/action owner. A protected layout,
  hidden button, request proxy, or client-side redirect alone does not protect an endpoint.
- Derive identity from a verified server session. Restrict reads and writes to resources and tenants
  that the caller can access. Check permissions on the server instead of trusting a browser-provided
  role or user ID.
- Test signed-out callers, another user's resource, another tenant, and revoked access. Database
  row-level security (RLS) adds access checks; keep admin clients restricted to operations that need
  their authority.
- Validate and bound all external input: bodies, query strings, path parameters, cookies, file
  uploads, cursors, and provider responses. Enforce size and resource limits. Validate file
  type/content and storage access where uploads exist. Raw strings do not become safe because
  TypeScript calls them IDs.
- Keep secrets in server configuration, validate required values, and fail clearly when absent.
  `NEXT_PUBLIC_*` values are public and substituted at build time. Avoid exporting server
  configuration through a shared barrel.
- Server-only markers and build checks enforce module boundaries; client environment lint is a
  limited additional check.
- Expose only safe DTO fields and stable error codes. Logs must not contain session tokens,
  authorization headers, passwords, private messages, full sensitive request bodies, or provider
  credentials. Record enough safe context to diagnose a failure, including correlation IDs where
  useful.
- Use the framework's supported Server Action and origin checks. Protect custom cookie-authenticated
  writes against cross-site request forgery (CSRF). Keep writes out of GET requests.
- Cross-Origin Resource Sharing (CORS) controls browser access to responses; authenticate callers
  separately. Allow credentialed cross-origin requests only from the required origins.
- Route Handlers use the correct method/status/content type and parse failures safely. Verify
  webhook signatures against the required raw body before processing, and handle replay/idempotency.
  Rate-limit costly public operations using deployment-appropriate shared state.
- Allow only approved redirect destinations and external fetch targets when users can influence
  them. Prevent server-side request forgery (SSRF) by checking internal address targets and each
  redirect in a chain.
- Validate untrusted input and use safe APIs before passing it to SQL, shell commands, HTML
  rendering, or browser navigation.
- Render user content as text or through a reviewed sanitizer. Rich Markdown/HTML links, embedded
  media, and translated rich text need explicit safe protocols/content rules. Do not use
  `dangerouslySetInnerHTML` for unsanitized user or provider output.
- Configure Content Security Policy (CSP) and other security headers for the application. Verify
  them with its rendering and scripts.
- Propagate cancellation and deadlines to streaming/provider work where supported. A disconnected
  browser must not leave avoidable expensive work running indefinitely. Handle partial stream
  failure separately from completion. Avoid unrestricted retries or unbounded request fan-out.
- Keep request state isolated across deployment instances and define which data each cache stores.
  Store sessions, uploads, and jobs in storage that survives instance restarts.
- Check Node, Edge, static export, and deployment adapter support before selecting runtime features.
  Use shared storage when a file or rate limit needs to be visible to several instances.

- Maintain dependency and secret scanning with the repository's tools and hooks. Investigate scanner
  findings and scope each suppression to a reviewed finding with a documented reason.
- Verify authorization and data isolation with negative integration cases and focused boundary
  review. Exercise the deployed application's access controls and runtime configuration.

### Keep configuration out of browser bundles

Keep private environment values out of `next.config.*`'s `env` option. That option makes configured
values available to client bundles regardless of whether their names start with `NEXT_PUBLIC_`. Read
secrets only from server runtime configuration. Expose a browser value through an explicit public
variable or a reviewed public DTO. Do not spread the process environment into build options, webpack
definitions, generated JavaScript, or HTML. See
[Next.js configuration environment variables](https://nextjs.org/docs/app/api-reference/config/next-config-js/env).

- Inspect the composed configuration, including wrappers, imported fragments, and deployment
  substitutions. A browser-only environment lint rule cannot inspect build-time injection by itself.
- Verify the browser output of a production build with harmless marker values when changing secret
  boundaries. Do not use real credentials as test data. If a credential was bundled into a
  delivered asset, removing the source reference alone does not revoke that credential.
- Keep type and lint failures visible. Do not enable `ignoreBuildErrors` or a version-specific
  `ignoreDuringBuilds` escape hatch to make delivery pass.
- Align Next, its ESLint configuration, React, the deployment adapter, and bundler plugins with the
  installed major versions. An older application's working configuration is not evidence that the
  same APIs or adapter work with a newer Next release.

### Check authorization where data is accessed

A redirect in a layout or proxy can improve navigation, but it cannot be the only place an operation
checks access. The operation may be called directly, invoked from a different route, or reached
after a session changes. Recheck access where protected data is read or changed.

Use verified identity consistently across data clients. A server admin/service-role client can
bypass database policy; keep it restricted to operations that explicitly need that authority.
Ordinary user operations retain the intended user and tenant context. Do not expose such a
client through a shared provider or browser configuration module.

Where the auth library ships a framework integration, use it consistently; do not combine its cookie
ownership with the older "Auth Helpers" package in the same authentication flow. Keep browser and request-scoped
server clients distinct, and use verified server identity for authorization. A client-side
`getSession()` read may supply a transport token but is not server authorization evidence. See
[Supabase server-side auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs).

When session refresh requires response cookie updates, use the authentication library's supported
integration for the installed Next/runtime release. Keep that behavior out of read-only RSC context
creation. Handle expired and revoked sessions as real transitions, including clearing browser caches
and preventing stale private views from reappearing through Back navigation.

### Render Markdown and rich editors safely

Markdown parsing is not HTML sanitization. `marked` explicitly leaves sanitization to its caller.
Render user and provider messages through one reviewed content boundary: either a renderer that
rejects raw HTML or parsed HTML passed through a maintained sanitizer with a defined allowlist.
Sanitize the final HTML after transformations and before any HTML sink. See
[Marked's sanitization guidance](https://marked.js.org/).

- Cover links, image sources, inline event attributes, embedded frames, SVG, and dangerous URL
  schemes. Do not rely on regex replacements, TypeScript assertions, or trusted-looking model output
  to make markup safe.
- Restrict `dangerouslySetInnerHTML` to a reviewed rendering adapter. The shared configuration's
  `react/no-danger` rule requires an explicit local suppression there, with a description naming the
  sanitizer or the exact trusted static source. Keep sanitization tests beside that adapter.
- Apply the same policy to streaming partial messages and final persisted messages. If parsing is
  asynchronous, prevent an older parse from overwriting the latest text or a different message.
- Initialize Tiptap in a Client Component with the installed version's supported SSR behavior,
  including `immediatelyRender: false` where required. Keep extension versions compatible. See
  [Tiptap's Next.js integration](https://tiptap.dev/docs/editor/getting-started/install/nextjs).
- Keep editor updates as editor transactions. Avoid serializing the full document, rewriting HTML,
  and calling `setContent` on every transaction; that can disturb selection, history, and input
  composition. Use supported decorations, marks, or targeted transactions for visual annotations.
- Do not submit while an IME composition is active. Test Enter, Shift+Enter, mobile keyboards,
  multiline paste at the current selection, undo/redo, and the empty-to-nonempty transition.
- Define the saved representation and its size limits. Editor JSON, HTML, and plain text have
  different contracts; an editor extension schema does not make arbitrary saved HTML trusted.

### Scope service workers and private media

Treat the browser's service-worker cache as an additional cache owner. HTTP headers and query-cache
invalidation do not automatically remove a response that a worker explicitly stored.

- Cache only the intended public assets. Exclude authenticated API responses, chat content,
  personalized RSC payloads, signed media URLs, and private media unless a deliberate private
  offline feature defines storage, expiry, logout, and account-switch behavior.
- Match worker routes against actual request URLs, methods, origins, and paths. A broad image-file
  suffix match can include authenticated media; a pathname regex may not match an absolute URL.
- Define cache versioning and worker activation behavior. Test an existing controlled tab during an
  update, offline reload, logout, account switching, and Back navigation. A new worker must not
  discard an unsaved draft or serve another account's content.
- For object storage, authorize the bucket and object path, not just the existence of a signed-in
  session. Test another user's object and each preview, blurred, watermarked, or transformed
  variant. Enforce resource access in database and storage policies.
- Treat signed URLs as bearer access with an expiry. Keep them out of telemetry and persistent
  shared caches. Bound refresh on expiry and clear account-scoped media/query state at logout.
- Prefer an authorized media delivery mechanism appropriate to the runtime over repeatedly moving
  large base64 media payloads through query caches. Test range requests, expiry during playback,
  interrupted loads, and memory use with several visible videos.
- Clean up image/video listeners, preload work, and object URLs. When `src` changes, ensure a late
  load event cannot mark the new source as loaded or keep a failed preview from blocking recovery.

### Separate telemetry and provider results

Use one initialization owner for browser analytics. Avoid loading both an inline bootstrap and an
SDK provider for the same tracker unless that integration explicitly requires both. Server routes
must use server-compatible telemetry, not import a module that initializes a browser SDK.

- Define allowed event properties. Mask or exclude chat transcripts, editor content, auth inputs,
  tokens, signed URLs, and private identifiers from autocapture and session replay. Verify the
  actual captured payloads, including custom controls, and contenteditable elements.
- Reset analytics identity on logout and account switch. Keep anonymous-to-authenticated identity
  changes explicit; a module's prior identity must not label a different user's events.
- Telemetry failure must not replace an operation's intended response, and diagnostic code must not
  throw again while handling the original failure. Bound awaited logging and use the runtime's
  supported lifecycle for deferred work.
- Check an SDK's returned error field as well as caught exceptions. For example,
  `resend.emails.send` can return `{ data, error }`; an awaited call is not by itself proof of
  acceptance. Return success only after confirming the provider result, and distinguish acceptance
  from delivery. See [Resend's Next.js example](https://resend.com/docs/send-with-nextjs).
- Restrict email recipients and sender identity on the server, validate `reply-to` input, and apply
  abuse controls to public feedback or OTP operations. Keep provider errors out of public responses.

### Endpoint and streaming lifecycle

For each Route Handler, define the allowed body size, content types, HTTP methods, validation,
authorization, error responses, and caching behavior. Check incoming data before processing it.

For each stream, define the signal that confirms completion. Distinguish that signal from an open
connection or partial data. Let the client represent partial output, completion, cancellation,
timeout, and failure after output has started. Define when to save the result and merge it with
existing data for each outcome.

- Propagate an abort signal to upstream work when the provider/runtime supports it.
- Bound total work, token/media size, concurrency, and request lifetime according to the endpoint's
  contract.
- Release readers, timers, subscriptions, and provider resources on completion, cancellation,
  failure, and client disconnect.
- Do not keep producing expensive output after cancellation because a detached promise lost access
  to the request lifecycle.
- Preserve the relationship between temporary browser output and persisted server entities. A retry
  must not silently duplicate the durable operation.
- Sanitize rendered provider/user output through the same content policy as other untrusted input. A
  generated answer is not trusted HTML.
- Keep error details out of a public stream while retaining safe diagnostic context on the server.
  Do not serialize raw upstream exception objects into chunks.

For a raw streaming Route Handler, use the Web Streams API and a defined wire format. Set content
type, cache policy, and other response headers before returning the stream.

- Respect backpressure: pace production when the consumer cannot keep up. Keep queues bounded and
  use supported piping or pull-based production for large output.
- Parse the application format independently of network chunks. A read can contain half a UTF-8
  character, part of a JSON record, or several events. Use incremental decoding and retain an
  incomplete record until it is complete.
- Define framing for Server-Sent Events or newline-delimited JSON rather than assuming one `enqueue`
  equals one client read.
- Close or cancel file handles and upstream readers according to the runtime's stream ownership
  rules. Stream large files incrementally instead of loading them fully into memory.
- Once headers are committed, report late failures through the defined stream protocol or close the
  failed stream. Do not try to append a second HTTP response or silently mark partial output as
  completed. Follow the existing cancellation and persistence rules above.

For SSE, use an established protocol parser when available. Decode UTF-8 incrementally, preserve
incomplete frames across reads, and dispatch an event only when its separator is complete. Support
the protocol's line endings, comments, and multiline `data:` fields. Do not parse every received
line as a complete event. Validate the parsed event payload instead of asserting its type.

Flush the decoder at end of input and apply the protocol's rule for incomplete trailing data. A
closed socket alone must not invoke a successful completion callback when the provider requires a
terminal event. Bound buffered bytes and accumulated output. Test split multibyte characters, split
JSON, multiple frames in one read, missing terminal events, malformed frames, and cancellation while
blocked in a read. See
[SSE framing](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

### Protect inference and retrieval endpoints

Treat an inference proxy, retrieval request, and usage-verification endpoint as separate callable
operations. Each must verify access and enforce its own resource budget before using a privileged
provider credential. A protected page or a prior chat-creation mutation does not protect a direct
request to another endpoint.

- Derive resource ownership and allowed model and provider choices on the server. Bound input
  bytes, context count, per-message size, output tokens, request duration, and concurrent work.
  Browser token estimates and disabled buttons are feedback, not quota enforcement.
- Keep private prompts and retrieved passages out of query strings, referrers, and analytics URLs.
  Use a bounded request body for sensitive or costly generation operations.
- Treat retrieved text and generated output as untrusted data. They cannot authorize a tool call,
  select an arbitrary credential, or override server access checks. Validate structured provider
  results before using them as identifiers or operational instructions.
- Give generation and durable persistence a clear owner. If generation succeeds but saving fails,
  retry persistence with the same operation identity instead of generating and charging again.
  Define how cancellation and provider errors affect partial output and reserved quota.
- Use shared quota and concurrency state when several instances serve requests. Test direct
  signed-out requests, another user's chat, oversized contexts, excessive output requests, retries,
  and concurrent submissions.

### Verify streaming

Measure streaming through the production adapter, proxy, CDN, and compression settings. A server
that produces chunks can still sit behind a layer that buffers the entire response.

- Check the host's response-streaming support and execution limits. Static export cannot perform
  request-time server streaming. Apply proxy buffering settings only to infrastructure that supports
  them; `X-Accel-Buffering: no` is not a universal CDN control.
- Check compression flushing and client buffering. Compare compressed delivery with a diagnostic
  request using `Accept-Encoding: identity` when the server honors it. Keep normal compression
  decisions based on measured user experience.
- Record request start, response headers, body-read timestamps, and completion. Starting the timer
  only after `fetch()` resolves hides the time spent waiting for headers.
- Inspect progressive visible content as well as timed body reads. An early first byte followed by a
  long download can have other causes and does not by itself prove sections streamed usefully.
- Treat network chunk boundaries as transport details. They need not match Suspense boundaries or
  producer writes. Streaming over HTTP/2 or HTTP/3 does not require an HTTP/1.1
  `Transfer-Encoding: chunked` header.
- Verify slow data, slow networks, cancellation, mid-stream errors, and representative crawler
  requests. Check that the final page has usable content and the expected metadata and status.
- Keep diagnostics independent of private React payload syntax. Use observable timing, section
  visibility, accessibility, and final outcomes as evidence.
